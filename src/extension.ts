import * as vscode from "vscode";
import axios from "axios";

interface NuGetPackage {
  id: string;
  version: string;
  description?: string;
  totalDownloads?: number;
}

interface NuGetSearchResult {
  data: Array<{
    id: string;
    version: string;
    description?: string;
    totalDownloads?: number;
    versions?: Array<{ version: string }>;
  }>;
}

interface SdkInfo {
  id: string;
  displayName: string;
  description: string;
  defaultTargetFramework?: string;
}

interface PropertyInfo {
  name: string;
  description: string;
  possibleValues?: string[];
  defaultValue?: string;
}

class DirectiveCompletionProvider implements vscode.CompletionItemProvider {
  private packageCache = new Map<string, NuGetPackage[]>();
  private cacheExpiry = new Map<string, number>();
   // 5 minutes
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  // Common .NET SDKs
  private readonly COMMON_SDKS: SdkInfo[] = [
    {
      id: "Microsoft.NET.Sdk",
      displayName: "Console/Library SDK",
      description: "Default SDK for console applications and class libraries",
      defaultTargetFramework: "net10.0"
    },
    {
      id: "Microsoft.NET.Sdk.Web",
      displayName: "Web SDK",
      description: "SDK for ASP.NET Core applications, Web APIs, and Blazor apps"
    },
    {
      id: "Microsoft.NET.Sdk.Worker",
      displayName: "Worker SDK",
      description: "SDK for background service applications and hosted services"
    },
    {
      id: "Microsoft.NET.Sdk.WindowsDesktop",
      displayName: "Windows Desktop SDK",
      description: "SDK for WPF and Windows Forms applications"
    },
    {
      id: "Microsoft.NET.Sdk.Razor",
      displayName: "Razor SDK",
      description: "SDK for Razor class libraries and components"
    },
    {
      id: "Microsoft.NET.Sdk.BlazorWebAssembly",
      displayName: "Blazor WebAssembly SDK",
      description: "SDK for Blazor WebAssembly applications"
    }
  ];

  // Common MSBuild properties for file-based apps
  private readonly COMMON_PROPERTIES: PropertyInfo[] = [
    {
      name: "LangVersion",
      description: "C# language version to use",
      possibleValues: ["latest", "preview", "12", "11", "10", "9", "8", "7.3", "7.2", "7.1", "7"],
      defaultValue: "latest"
    },
    {
      name: "TargetFramework",
      description: "Target framework for the application",
      possibleValues: ["net10.0", "net9.0", "net8.0", "net7.0", "net6.0", "netstandard2.1", "netstandard2.0"],
      defaultValue: "net10.0"
    },
    {
      name: "Nullable",
      description: "Nullable reference types setting",
      possibleValues: ["enable", "disable", "warnings", "annotations"],
      defaultValue: "enable"
    },
    {
      name: "ImplicitUsings",
      description: "Enable implicit using statements",
      possibleValues: ["enable", "disable"],
      defaultValue: "enable"
    },
    {
      name: "TreatWarningsAsErrors",
      description: "Treat compiler warnings as errors",
      possibleValues: ["true", "false"],
      defaultValue: "false"
    },
    {
      name: "WarningLevel",
      description: "Compiler warning level",
      possibleValues: ["0", "1", "2", "3", "4", "5"],
      defaultValue: "4"
    },
    {
      name: "OutputType",
      description: "Type of output to generate",
      possibleValues: ["Exe", "Library", "Module", "Winexe"],
      defaultValue: "Exe"
    },
    {
      name: "PublishAot",
      description: "Enable ahead-of-time compilation for publishing",
      possibleValues: ["true", "false"],
      defaultValue: "false"
    },
    {
      name: "InvariantGlobalization",
      description: "Enable invariant globalization mode",
      possibleValues: ["true", "false"],
      defaultValue: "false"
    },
    {
      name: "EnablePreviewFeatures",
      description: "Enable preview language and runtime features",
      possibleValues: ["true", "false"],
      defaultValue: "false"
    }
  ];

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    const linePrefix = document
      .lineAt(position)
      .text.substring(0, position.character);

    // Check for different directive types
    const packageMatch = linePrefix.match(/^#:package\s+([^@\s]*)/);
    const packageVersionMatch = linePrefix.match(/^#:package\s+(\w+(?:\.\w+)*)@(.*)$/);
    const sdkMatch = linePrefix.match(/^#:sdk\s+(.*)$/);
    const propertyMatch = linePrefix.match(/^#:property\s+(\w*)\s*(.*)$/);

    // Handle #:package directives
    if (packageMatch) {
      if (packageVersionMatch) {
        const [, packageId, versionPrefix] = packageVersionMatch;
        return this.getVersionCompletions(packageId, versionPrefix);
      }
      return this.getPackageCompletions(packageMatch[1] || "");
    }

    // Handle #:sdk directives
    if (sdkMatch) {
      return this.getSdkCompletions(sdkMatch[1]);
    }

    // Handle #:property directives
    if (propertyMatch) {
      const [, propertyName, propertyValue] = propertyMatch;
      if (propertyName && propertyValue !== undefined) {
        return this.getPropertyValueCompletions(propertyName, propertyValue);
      }
      return this.getPropertyNameCompletions(propertyName || "");
    }

    // Check if we're starting a new directive
    const directivePrefix = linePrefix.match(/^#:(\w*)$/);
    if (directivePrefix) {
      return this.getDirectiveCompletions(directivePrefix[1]);
    }

    return [];
  }

  private getDirectiveCompletions(prefix: string): vscode.CompletionItem[] {
    const directives = [
      {
        name: "package",
        description: "Reference a NuGet package",
        example: "#:package Humanizer@2.14.1"
      },
      {
        name: "sdk",
        description: "Specify the SDK to use",
        example: "#:sdk Microsoft.NET.Sdk.Web"
      },
      {
        name: "property",
        description: "Set MSBuild properties",
        example: "#:property LangVersion preview"
      }
    ];

    return directives
      .filter(d => d.name.startsWith(prefix))
      .map(directive => {
        const item = new vscode.CompletionItem(
          directive.name,
          vscode.CompletionItemKind.Keyword
        );
        item.insertText = `${directive.name} `;
        item.detail = directive.description;
        item.documentation = new vscode.MarkdownString(
          `${directive.description}\n\nExample: \`${directive.example}\``
        );
        return item;
      });
  }

  private getSdkCompletions(query: string): vscode.CompletionItem[] {
    return this.COMMON_SDKS
      .filter(sdk => sdk.id.toLowerCase().includes(query.toLowerCase()))
      .map(sdk => {
        const item = new vscode.CompletionItem(
          sdk.id,
          vscode.CompletionItemKind.Module
        );
        item.insertText = sdk.id;
        item.detail = sdk.displayName;

        const markdown = new vscode.MarkdownString();
        markdown.appendMarkdown(`**${sdk.displayName}**\n\n`);
        markdown.appendMarkdown(`${sdk.description}\n\n`);
        if (sdk.defaultTargetFramework) {
          markdown.appendMarkdown(`Default Target Framework: \`${sdk.defaultTargetFramework}\`\n\n`);
        }
        markdown.appendMarkdown(
          `[Learn more about .NET SDKs](https://docs.microsoft.com/en-us/dotnet/core/project-sdk/overview)`
        );

        item.documentation = markdown;
        return item;
      });
  }

  private getPropertyNameCompletions(query: string): vscode.CompletionItem[] {
    return this.COMMON_PROPERTIES
      .filter(prop => prop.name.toLowerCase().includes(query.toLowerCase()))
      .map(property => {
        const item = new vscode.CompletionItem(
          property.name,
          vscode.CompletionItemKind.Property
        );
        item.insertText = `${property.name} `;
        item.detail = property.description;

        const markdown = new vscode.MarkdownString();
        markdown.appendMarkdown(`**${property.name}**\n\n`);
        markdown.appendMarkdown(`${property.description}\n\n`);
        if (property.defaultValue) {
          markdown.appendMarkdown(`Default: \`${property.defaultValue}\`\n\n`);
        }
        if (property.possibleValues) {
          markdown.appendMarkdown(`Possible values: ${property.possibleValues.map(v => `\`${v}\``).join(", ")}\n\n`);
        }

        item.documentation = markdown;
        return item;
      });
  }

  private getPropertyValueCompletions(propertyName: string, valuePrefix: string): vscode.CompletionItem[] {
    const property = this.COMMON_PROPERTIES.find(p => p.name === propertyName);
    if (!property || !property.possibleValues) {
      return [];
    }

    return property.possibleValues
      .filter(value => value.toLowerCase().startsWith(valuePrefix.toLowerCase()))
      .map(value => {
        const item = new vscode.CompletionItem(
          value,
          vscode.CompletionItemKind.Value
        );
        item.insertText = value;
        item.detail = `${propertyName} value`;
        if (value === property.defaultValue) {
          item.detail += " (default)";
        }
        return item;
      });
  }

  private async getPackageCompletions(query: string): Promise<vscode.CompletionItem[]> {
    if (!query) {
      return [];
    }

    try {
      const packages = await this.searchPackages(query);
      return packages.map((pkg) => this.createPackageCompletionItem(pkg));
    } catch (error) {
      console.error("Error fetching packages:", error);
      return [];
    }
  }

  private async getVersionCompletions(
    packageId: string,
    versionPrefix: string
  ): Promise<vscode.CompletionItem[]> {
    try {
      const response = await axios.get(
        `https://api.nuget.org/v3-flatcontainer/${packageId.toLowerCase()}/index.json`,
        { timeout: 5000 }
      );

      const versions: string[] = response.data.versions || [];

      const filteredVersions = versions
        .filter((v) => !v.includes("-") && v.startsWith(versionPrefix))
        .sort((a, b) => this.compareVersions(b, a))
        .slice(0, 10);

      return filteredVersions.map((version) => {
        const item = new vscode.CompletionItem(
          version,
          vscode.CompletionItemKind.Value
        );
        item.insertText = version;
        item.detail = `Version ${version}`;
        item.sortText = version.padStart(20, "0");
        return item;
      });
    } catch (error) {
      console.error(`Failed to get versions for ${packageId}:`, error);
      return [];
    }
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;

      if (partA !== partB) {
        return partA - partB;
      }
    }
    return 0;
  }

  private async searchPackages(query: string): Promise<NuGetPackage[]> {
    const cacheKey = query.toLowerCase();
    const now = Date.now();

    if (
      this.packageCache.has(cacheKey) &&
      this.cacheExpiry.has(cacheKey) &&
      this.cacheExpiry.get(cacheKey)! > now
    ) {
      return this.packageCache.get(cacheKey)!;
    }

    try {
      const response = await axios.get<NuGetSearchResult>(
        `https://azuresearch-usnc.nuget.org/query`,
        {
          params: {
            q: query,
            take: 20,
            prerelease: false,
          },
          timeout: 5000,
        }
      );

      const packages: NuGetPackage[] = response.data.data.map((item) => ({
        id: item.id,
        version: item.version,
        description: item.description,
        totalDownloads: item.totalDownloads,
      }));

      this.packageCache.set(cacheKey, packages);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      return packages;
    } catch (error) {
      console.error(`Failed to search packages for "${query}":`, error);
      return [];
    }
  }

  private createPackageCompletionItem(pkg: NuGetPackage): vscode.CompletionItem {
    const item = new vscode.CompletionItem(
      pkg.id,
      vscode.CompletionItemKind.Module
    );

    item.insertText = `${pkg.id}@${pkg.version}`;

    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`**${pkg.id}**\n\n`);
    if (pkg.description) {
      markdown.appendMarkdown(`${pkg.description}\n\n`);
    }
    markdown.appendMarkdown(`Version: \`${pkg.version}\`\n\n`);
    if (pkg.totalDownloads) {
      markdown.appendMarkdown(
        `Downloads: ${pkg.totalDownloads.toLocaleString()}\n\n`
      );
    }
    markdown.appendMarkdown(
      `[View on NuGet](https://www.nuget.org/packages/${pkg.id})`
    );

    item.documentation = markdown;

    item.sortText = pkg.totalDownloads
      ? String(999999999 - pkg.totalDownloads).padStart(10, "0")
      : "9999999999";

    item.detail = `v${pkg.version}${
      pkg.totalDownloads
        ? ` • ${pkg.totalDownloads.toLocaleString()} downloads`
        : ""
    }`;

    return item;
  }
}

class DirectiveHoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    const line = document.lineAt(position);
    
    // Check for package directive
    const packageMatch = line.text.match(/^#:package\s+(\w+(?:\.\w+)*)@?([\d\.]*)/);
    if (packageMatch) {
      return this.getPackageHover(packageMatch, document, position);
    }

    // Check for SDK directive
    const sdkMatch = line.text.match(/^#:sdk\s+([\w\.]+)/);
    if (sdkMatch) {
      return this.getSdkHover(sdkMatch, document, position);
    }

    // Check for property directive
    const propertyMatch = line.text.match(/^#:property\s+(\w+)\s+(.+)/);
    if (propertyMatch) {
      return this.getPropertyHover(propertyMatch, document, position);
    }

    return undefined;
  }

  private async getPackageHover(
    match: RegExpMatchArray,
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | undefined> {
    const [, packageId, version] = match;
    const wordRange = document.getWordRangeAtPosition(position);

    if (!wordRange) {
      return undefined;
    }

    try {
      const response = await axios.get(
        `https://azuresearch-usnc.nuget.org/query?q=packageid:${packageId}&take=1`,
        { timeout: 5000 }
      );
      const packageData = response.data.data[0];

      if (!packageData) {
        return undefined;
      }

      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`**${packageData.id}**\n\n`);
      if (packageData.description) {
        markdown.appendMarkdown(`${packageData.description}\n\n`);
      }
      markdown.appendMarkdown(`Current Version: \`${packageData.version}\`\n\n`);
      if (packageData.totalDownloads) {
        markdown.appendMarkdown(
          `Total Downloads: ${packageData.totalDownloads.toLocaleString()}\n\n`
        );
      }
      markdown.appendMarkdown(
        `[View on NuGet](https://www.nuget.org/packages/${packageData.id})`
      );

      return new vscode.Hover(markdown, wordRange);
    } catch (error) {
      console.error("Error fetching package info for hover:", error);
      return undefined;
    }
  }

  private getSdkHover(
    match: RegExpMatchArray,
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
    const [, sdkId] = match;
    const wordRange = document.getWordRangeAtPosition(position);

    if (!wordRange) {
      return undefined;
    }

    const sdkInfo = this.findSdkInfo(sdkId);
    if (!sdkInfo) {
      return undefined;
    }

    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`**${sdkInfo.displayName}**\n\n`);
    markdown.appendMarkdown(`${sdkInfo.description}\n\n`);
    markdown.appendMarkdown(`SDK: \`${sdkInfo.id}\`\n\n`);
    if (sdkInfo.defaultTargetFramework) {
      markdown.appendMarkdown(`Default Target Framework: \`${sdkInfo.defaultTargetFramework}\`\n\n`);
    }
    markdown.appendMarkdown(
      `[Learn more about .NET SDKs](https://docs.microsoft.com/en-us/dotnet/core/project-sdk/overview)`
    );

    return new vscode.Hover(markdown, wordRange);
  }

  private getPropertyHover(
    match: RegExpMatchArray,
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
    const [, propertyName, propertyValue] = match;
    const wordRange = document.getWordRangeAtPosition(position);

    if (!wordRange) {
      return undefined;
    }

    const propertyInfo = this.findPropertyInfo(propertyName);
    if (!propertyInfo) {
      return undefined;
    }

    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`**${propertyInfo.name}**\n\n`);
    markdown.appendMarkdown(`${propertyInfo.description}\n\n`);
    markdown.appendMarkdown(`Current Value: \`${propertyValue}\`\n\n`);
    if (propertyInfo.defaultValue) {
      markdown.appendMarkdown(`Default Value: \`${propertyInfo.defaultValue}\`\n\n`);
    }
    if (propertyInfo.possibleValues) {
      markdown.appendMarkdown(
        `Possible values: ${propertyInfo.possibleValues.map(v => `\`${v}\``).join(", ")}\n\n`
      );
    }
    markdown.appendMarkdown(
      `[Learn more about MSBuild properties](https://docs.microsoft.com/en-us/dotnet/core/project-sdk/msbuild-props)`
    );

    return new vscode.Hover(markdown, wordRange);
  }

  private findSdkInfo(sdkId: string) {
    // Define the same SDK info as in the completion provider
    const COMMON_SDKS = [
      {
        id: "Microsoft.NET.Sdk",
        displayName: "Console/Library SDK",
        description: "Default SDK for console applications and class libraries",
        defaultTargetFramework: "net10.0"
      },
      {
        id: "Microsoft.NET.Sdk.Web",
        displayName: "Web SDK",
        description: "SDK for ASP.NET Core applications, Web APIs, and Blazor apps"
      },
      {
        id: "Microsoft.NET.Sdk.Worker",
        displayName: "Worker SDK",
        description: "SDK for background service applications and hosted services"
      },
      {
        id: "Microsoft.NET.Sdk.WindowsDesktop",
        displayName: "Windows Desktop SDK",
        description: "SDK for WPF and Windows Forms applications"
      },
      {
        id: "Microsoft.NET.Sdk.Razor",
        displayName: "Razor SDK",
        description: "SDK for Razor class libraries and components"
      },
      {
        id: "Microsoft.NET.Sdk.BlazorWebAssembly",
        displayName: "Blazor WebAssembly SDK",
        description: "SDK for Blazor WebAssembly applications"
      }
    ];

    return COMMON_SDKS.find(sdk => sdk.id === sdkId);
  }

  private findPropertyInfo(propertyName: string) {
    // Define the same property info as in the completion provider
    const COMMON_PROPERTIES = [
      {
        name: "LangVersion",
        description: "C# language version to use",
        possibleValues: ["latest", "preview", "12", "11", "10", "9", "8", "7.3", "7.2", "7.1", "7"],
        defaultValue: "latest"
      },
      {
        name: "TargetFramework",
        description: "Target framework for the application",
        possibleValues: ["net10.0", "net9.0", "net8.0", "net7.0", "net6.0", "netstandard2.1", "netstandard2.0"],
        defaultValue: "net10.0"
      },
      {
        name: "Nullable",
        description: "Nullable reference types setting",
        possibleValues: ["enable", "disable", "warnings", "annotations"],
        defaultValue: "enable"
      },
      {
        name: "ImplicitUsings",
        description: "Enable implicit using statements",
        possibleValues: ["enable", "disable"],
        defaultValue: "enable"
      },
      {
        name: "TreatWarningsAsErrors",
        description: "Treat compiler warnings as errors",
        possibleValues: ["true", "false"],
        defaultValue: "false"
      },
      {
        name: "WarningLevel",
        description: "Compiler warning level",
        possibleValues: ["0", "1", "2", "3", "4", "5"],
        defaultValue: "4"
      },
      {
        name: "OutputType",
        description: "Type of output to generate",
        possibleValues: ["Exe", "Library", "Module", "Winexe"],
        defaultValue: "Exe"
      },
      {
        name: "PublishAot",
        description: "Enable ahead-of-time compilation for publishing",
        possibleValues: ["true", "false"],
        defaultValue: "false"
      },
      {
        name: "InvariantGlobalization",
        description: "Enable invariant globalization mode",
        possibleValues: ["true", "false"],
        defaultValue: "false"
      },
      {
        name: "EnablePreviewFeatures",
        description: "Enable preview language and runtime features",
        possibleValues: ["true", "false"],
        defaultValue: "false"
      }
    ];

    return COMMON_PROPERTIES.find(prop => prop.name === propertyName);
  }
}

export function activate(context: vscode.ExtensionContext) {
  const completionProvider = new DirectiveCompletionProvider();
  const hoverProvider = new DirectiveHoverProvider();

  // Register completion provider for C# files with comprehensive triggers
  const completionDisposable = vscode.languages.registerCompletionItemProvider(
    { scheme: "file", language: "csharp" },
    completionProvider,
    "#", // Trigger for directive start
    ":", // Trigger after #:
    " ", // Trigger after directive name
    "@", // Trigger for package version completion
    "." // Trigger for package name completion with dots
  );

  // Register hover provider for comprehensive directive information
  const hoverDisposable = vscode.languages.registerHoverProvider(
    { scheme: "file", language: "csharp" },
    hoverProvider
  );

  context.subscriptions.push(completionDisposable, hoverDisposable);

  console.log("C# File-Based App Directive Support extension activated!");
}

export function deactivate() {}