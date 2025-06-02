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

class PackageCompletionProvider implements vscode.CompletionItemProvider {
  private packageCache = new Map<string, NuGetPackage[]>();
  private cacheExpiry = new Map<string, number>();
  // 5 minutes
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    const linePrefix = document
      .lineAt(position)
      .text.substr(0, position.character);

    // Check if we're in a #:package directive
    const packageMatch = linePrefix.match(/^#:package\s+([^@\s]*)/);
    const versionMatch = linePrefix.match(/^#:package\s+(\w+(?:\.\w+)*)@(.*)$/);

    if (!packageMatch) {
      return [];
    }

    // If we're completing after @, provide version suggestions
    if (versionMatch) {
      const [, packageId, versionPrefix] = versionMatch;
      return this.getVersionCompletions(packageId, versionPrefix);
    }

    // Regular package name completion
    const query = packageMatch[1] || "";

    try {
      const packages = await this.searchPackages(query);
      return packages.map((pkg) => this.createCompletionItem(pkg));
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

      // Filter and sort versions (latest first)
      const filteredVersions = versions
        // Exclude prereleases and filter by prefix
        .filter((v) => !v.includes("-") && v.startsWith(versionPrefix))
        // Sort descending (latest first)
        .sort((a, b) => this.compareVersions(b, a))
        // Limit to 10 versions
        .slice(0, 10);

      return filteredVersions.map((version) => {
        const item = new vscode.CompletionItem(
          version,
          vscode.CompletionItemKind.Value
        );
        item.insertText = version;
        item.detail = `Version ${version}`;
        // Ensure proper sorting
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

    // Check cache
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

      // Cache results
      this.packageCache.set(cacheKey, packages);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      return packages;
    } catch (error) {
      console.error(`Failed to search packages for "${query}":`, error);
      return [];
    }
  }

  private createCompletionItem(pkg: NuGetPackage): vscode.CompletionItem {
    const item = new vscode.CompletionItem(
      pkg.id,
      vscode.CompletionItemKind.Module
    );

    // Insert both package name and version
    item.insertText = `${pkg.id}@${pkg.version}`;

    // Rich documentation
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

    // Sort by popularity (downloads)
    item.sortText = pkg.totalDownloads
      ? String(999999999 - pkg.totalDownloads).padStart(10, "0")
      : "9999999999";

    // Additional details in the completion item
    item.detail = `v${pkg.version}${
      pkg.totalDownloads
        ? ` • ${pkg.totalDownloads.toLocaleString()} downloads`
        : ""
    }`;

    return item;
  }
}

class PackageHoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    const line = document.lineAt(position);
    const packageMatch = line.text.match(
      /^#:package\s+(\w+(?:\.\w+)*)@?([\d\.]*)/
    );

    if (!packageMatch) {
      return undefined;
    }

    const [, packageId, version] = packageMatch;
    const wordRange = document.getWordRangeAtPosition(position);

    if (
      !wordRange ||
      !line.text
        .substring(wordRange.start.character, wordRange.end.character)
        .includes(packageId.split(".")[0])
    ) {
      return undefined;
    }

    try {
      const response = await axios.get(
        `https://azuresearch-usnc.nuget.org/query?q=packageid:${packageId}&take=1`
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
      markdown.appendMarkdown(
        `Current Version: \`${packageData.version}\`\n\n`
      );
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
}

export function activate(context: vscode.ExtensionContext) {
  const completionProvider = new PackageCompletionProvider();
  const hoverProvider = new PackageHoverProvider();

  // Register completion provider for C# files with proper triggers
  const completionDisposable = vscode.languages.registerCompletionItemProvider(
    { scheme: "file", language: "csharp" },
    completionProvider,
    " ", // Trigger after space in "#:package "
    "@", // Trigger for version completion after @
    "." // Trigger for package name completion with dots
  );

  // Register hover provider for package information
  const hoverDisposable = vscode.languages.registerHoverProvider(
    { scheme: "file", language: "csharp" },
    hoverProvider
  );

  context.subscriptions.push(completionDisposable, hoverDisposable);

  console.log("C# Package Autocomplete extension activated!");
}

export function deactivate() {}
