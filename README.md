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

### Compiling only works on Windows and Mac.
This is due to the extension not relying on the AQSIS binaries to be in the path,
instead using their direct path to run them.
However I only know of the binary path on Windows and Mac,
which means that the binaries cannot run on any other systems for now.

## TODO

* Add linting for error messages.

## Release Notes

## [0.3.0] - 2019-01-27
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
