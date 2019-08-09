# ADIEU

## What  is it

Another Desktop Icons Extension for GNOME Shell.

## Requirements

* GNOME Shell >= 3.30
* Nautilus >= 3.30.4


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