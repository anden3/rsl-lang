# rsl-lang README

An extension for Visual Studio Code which (eventually) adds full support to the RenderMan Shading Language (RSL) and RenderMan Interface Bytestream (RIB) languages.

## Features

### Automatic compilation

While editing any `.sl` or `.rib` file, simply press the `rsl-lang.compileRIB` hotkey and the scene will be rendered and the resulting image will be created and displayed to the side of the editor.
> TODO: Add animation here.

### Color support

All `.sl` files now display a color picker besides any colors defined in the file.
> TODO: Add animation here.

### Syntax highlighting

All `.sl` files now have any functions, keywords, comments, etc... colored according to your active color theme.
> TODO: Add example image here.

## Requirements

### AQSIS Renderer
Can be downloaded from `https://sourceforge.net/projects/aqsis/` or `https://github.com/aqsis/aqsis`.

## Extension Settings

This extension contributes the following settings:

* `rsl.aqsis.path`: Where your AQSIS installation is. For example `/Applications/Aqsis.app` on Mac, and `C:\Program Files (x86)\AQSIS` on Windows.

* `rsl.aqsis.binPath`: Where the AQSIS binaries are. Look below for a known issue with this.

* `rsl.compiledShaderFolder`: Where the extension should look for compiled shaders. Defaults to `shaders`.

* `rsl.renderedImageFolder`: Where the extension should put rendered images. Defaults to `images`.

* `rsl.images.format`: What format to save the rendered images in. Defaults to `PNG`.

* `rsl.images.keepHistory`: If new rendered images should be put in a folder along with older images. Defaults to `false`.

* `rsl.images.timestamp` If rendered images should use a timestamp for their name. Defaults to `false`.

## Keybindings

* `rsl-lang.compileRIB`: Start compiling and rendering the scene.

## Known Issues

Nothing as of now.

## Planned Features

* Add linting for error messages.

## Release Notes

### [0.4.0] - 2019-01-28
- Added - If `rsl.aqsis.path` have not been defined when the extension is activated, it will now prompt the user to select the installation directory.

- Added - If `rsl.aqsis.binPath` have not been defined when the extension is activated, but `rsl.aqsis.path` has been, it will now iterate through the directories in the AQSIS installation until it finds the bin folder and set that as the path.

### [0.3.1] - 2019-01-28
- Fixed - Timestamps no longer include `:` characters, as that is not allowed on Windows.

- Fixed - All shell commands are now quoted to allow for spaces in paths.

- Fixed - `rsl.images.format` now actually has a default (`PNG`), I forgot to add it last time.

- Fixed - Added missing semicolons after imports.

### [0.3.0] - 2019-01-27
- Added - Syntax highlighting should now be complete for .sl files.

- Added - Compiling should now work, although showing errors is not implemented yet.

- Added - Option to keep old rendered images: `rsl.images.keepHistory` (default: false).

- Added - Option to name rendered images with a timestamp: `rsl.images.timestamp` (default: false).

- Added - Option to pick format of rendered images: `rsl.images.format` (default: `PNG`).

### [0.2.0] - 2019-01-25
- Added - Very basic support for compiling shaders.

### [0.1.0] - 2019-01-24
- Initial release

- Added - Support for changing colors inside .sl files.
- Added - Started work on syntax highlighting, looks pretty bad at the moment.
