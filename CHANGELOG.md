# Change Log

## [0.3.1] - 2019-01-28
- Fixed - Timestamps no longer include `:` characters, as that is not allowed on Windows.

- Fixed - All shell commands are now quoted to allow for spaces in paths.

- Fixed - `rsl.images.format` now actually has a default (`PNG`), I forgot to add it last time.

- Fixed - Added missing semicolons after imports.

## [0.3.0] - 2019-01-27
- Added - Syntax highlighting should now be complete for .sl files.

- Added - Compiling should now work, although showing errors is not implemented yet.

- Added - Option to keep old rendered images: `rsl.images.keepHistory` (default: false).

- Added - Option to name rendered images with a timestamp: `rsl.images.timestamp` (default: false).

- Added - Option to pick format of rendered images: `rsl.images.format` (default: `PNG`).

## [0.2.0] - 2019-01-25
- Added - Very basic support for compiling shaders.

## [0.1.0] - 2019-01-24
- Initial release

- Added - Support for changing colors inside .sl files.
- Added - Started work on syntax highlighting, looks pretty bad at the moment.