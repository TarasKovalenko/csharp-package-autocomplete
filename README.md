# C# Package Autocomplete

[![Made in Ukraine](https://img.shields.io/badge/made_in-ukraine-ffd700.svg?labelColor=0057b7)](https://taraskovalenko.github.io/)
[![Version](https://img.shields.io/visual-studio-marketplace/v/taraskovalenko.csharp-package-autocomplete)](https://marketplace.visualstudio.com/items?itemName=taraskovalenko.csharp-package-autocomplete)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/taraskovalenko.csharp-package-autocomplete)](https://marketplace.visualstudio.com/items?itemName=taraskovalenko.csharp-package-autocomplete)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/taraskovalenko.csharp-package-autocomplete)](https://marketplace.visualstudio.com/items?itemName=taraskovalenko.csharp-package-autocomplete)

Supercharge your C# top-level programs with intelligent NuGet package autocomplete! This extension provides seamless autocomplete for `#:package` directives, making it effortless to add and manage NuGet packages in your C# scripts.

![alt text](image.png)

## Terms of use

By using this project or its source code, for any purpose and in any shape or form, you grant your **implicit agreement** to all of the following statements:

- You unequivocally condemn Russia and its military aggression against Ukraine
- You recognize that Russia is an occupant that unlawfully invaded a sovereign state
- You agree that [Russia is a terrorist state](https://www.europarl.europa.eu/doceo/document/RC-9-2022-0482_EN.html)
- You fully support Ukraine's territorial integrity, including its claims
  over [temporarily occupied territories](https://en.wikipedia.org/wiki/Russian-occupied_territories_of_Ukraine)
- You reject false narratives perpetuated by Russian state propaganda

To learn more about the war and how you can help, [click here](https://war.ukraine.ua/). Glory to Ukraine! 🇺🇦

## ✨ Features

### 🔍 **Smart Package Search**
- Type `#:package` and get instant autocomplete suggestions from the official NuGet repository
- Intelligent search with fuzzy matching for package names
- Real-time package information with descriptions and download statistics

### 🏷️ **Version Management**
- Type `@` after a package name to get version suggestions
- Shows latest stable versions first (excludes pre-release)
- Easy selection from available version history

### 📖 **Rich Documentation**
- Hover over any package to see detailed information
- Package descriptions, download counts, and direct links to NuGet
- Visual indicators for package popularity

### ⚡ **Performance Optimized**
- Intelligent caching reduces API calls and improves response time
- Non-blocking searches don't interrupt your coding flow
- Minimal resource usage

## 🚀 Getting Started

### Installation

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "C# Package Autocomplete"
4. Click "Install"

### Usage

1. **Create a C# file** with `.cs` extension
2. **Type the package directive**:
   ```csharp
   #:package 
   ```
3. **Start typing a package name** and see autocomplete suggestions
4. **Add version** by typing `@` after the package name
5. **Run your script** with the new .NET CLI

## 📝 Examples

### Basic Usage
```csharp
#:package Humanizer@2.14.1

using Humanizer;

var dotNet9Released = DateTimeOffset.Parse("2024-12-03");
var since = DateTimeOffset.Now - dotNet9Released;

Console.WriteLine($"It has been {since.Humanize()} since .NET 9 was released.");
```

### Multiple Packages
```csharp
#:package Newtonsoft.Json@13.0.3
#:package Serilog@3.1.1
#:package FluentValidation@11.8.0

using Newtonsoft.Json;
using Serilog;
using FluentValidation;

// Your code here...
```

### Web API Example
```csharp
#:package Microsoft.AspNetCore.App@8.0.0
#:package Swashbuckle.AspNetCore@6.5.0

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/", () => "Hello World!");
app.Run();
```

## ⚙️ Configuration

No configuration needed! The extension works out of the box with sensible defaults.

### Settings (Optional)

Future versions may include these customizable settings:

- Cache duration for package searches
- Number of suggestions to display
- Include/exclude pre-release packages
- Custom package source URLs

## 🔧 Requirements

- **Visual Studio Code** 1.74.0 or higher
- **Internet connection** for package search (cached results work offline)
- **.NET SDK** with top-level program support

## 🐛 Known Issues

- **Network dependency**: Requires internet connection for initial package searches
- **API rate limits**: Heavy usage might temporarily reduce suggestion speed
- **Case sensitivity**: Package names are case-sensitive in NuGet

## 📋 Roadmap

- [ ] **Custom package sources** - Support for private NuGet feeds
- [ ] **Dependency visualization** - Show package dependencies
- [ ] **Version comparison** - Compare versions with changelogs
- [ ] **Package templates** - Quick scaffolding for common scenarios
- [ ] **Offline mode** - Offline package suggestions
- [ ] **IntelliSense integration** - Enhanced code completion for imported packages

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Report bugs** by creating issues on GitHub
2. **Request features** through GitHub discussions
3. **Submit pull requests** for bug fixes or new features
4. **Share feedback** and rate the extension

### Development Setup

```bash
# Clone the repository
git clone https://github.com/TarasKovalenko/csharp-package-autocomplete

# Install dependencies
npm ci

# Compile TypeScript
npm run compile

# Package extension
npm run package
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💝 Support

If you find this extension helpful:

- ⭐ **Star the repository** on GitHub
- 📝 **Leave a review** on the VS Code Marketplace
- 🐦 **Share it** with your fellow developers

## 🙏 Acknowledgments

- **Microsoft** for the amazing .NET ecosystem and top-level programs feature
- **NuGet team** for the comprehensive package API
- **VS Code team** for the excellent extension platform
- **Community** for feedback and contributions

---

**Happy coding with C# and NuGet packages!** 🚀

*Made with ❤️ for the .NET community*