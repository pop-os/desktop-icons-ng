# ADIEU

## What  is it

Another Desktop Icons Extension for GNOME Shell. It offers the same than the official one,
but also has these advantages:

 * Drag'n'Drop, both inside the desktop, and between desktop and applications, and nautilus windows
 * Allows to use "Open with..." option with several files
 * Doesn't hang the compositor when there is too much activity in the desktop folder
 * Faster

But it is still an alpha development, so it probably still have a lot of bugs. Use with care.

## Current version

Version 0.1.0 alpha.

## Requirements

* GNOME Shell >= 3.30
* Nautilus >= 3.30.4

## TO-DO

* Use file events instead of refreshing the whole desktop
* Don't try to execute files with +x if they aren't true executables

## How to contribute

* Download the code
* Build with Meson (see at the next section)
* Log out & log in from your user session. Alternatively, just restart the computer.
* Activate the extension in GNOME Tweaks

## Build with Meson

The project uses a build system called [Meson](https://mesonbuild.com/). You can install
in most Linux distributions as "meson".

It's possible to read more information in the Meson docs to tweak the configuration if needed.

For a regular use and local development these are the steps to build the
project and install it:

```bash
meson --prefix=$HOME/.local/ --localedir=share/gnome-shell/extensions/adieu@rastersoft.com/locale .build
ninja -C .build install
```

It is strongly recommended to delete the destination folder
($HOME/.local/share/gnome-shell/extensions/adieu@rastersoft.com) before doing this, to ensure that no old
data is kept.

## Export extension ZIP file for extensions.gnome.org

To create a ZIP file with the extension, just run:

```bash
./export-zip.sh
```

This will create the file `adieu@rastersoft.com.zip` with the extension, following the rules for publishing at extensions.gnome.org.
