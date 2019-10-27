# DING Desktop Icons New Generation

## What  is it

Desktop Icons NG for GNOME Shell. It is a fork/rewrite of the official 'Desktop Icons' extension,
with these advantages:

 * Drag'n'Drop, both inside the desktop, between desktop and applications, and nautilus windows
 * Allows to use "Open with..." option with several files
 * When hovering or clicking on an icon with a name too large to fit, it shows the full name
 * Doesn't hang the compositor when there is too much activity in the desktop folder

But it is still an alpha development, so it probably still have a lot of bugs. Use with care.

## Current version

Version 0.6.0 alpha.

## Requirements

* GNOME Shell >= 3.30
* Nautilus >= 3.30.4

## TO-DO

* Use file events instead of refreshing the whole desktop
* Add support for dropping text or browser URIs

## Internal architecture

The code is divided in two parts: a classic Gtk program that manages the whole desktop
(comprised by the files ding.js, askNamePopup.js, createThumbnail.js, dbusUtils.js, desktopGrid.js,
desktopIconsUtil.js, desktopManager.js, enums.js, fileItem.js and preferences.js), and a little
extension (extension.js) that have these roles:

 * Launch the desktop program at startup and relaunch it if it dies
 * Identify the desktop windows and keep it at the bottom of the windows stack, in all desktops

This last part is paramount in Wayland systems, because there an application can't set its role
as freely as in X11.

Of course, to avoid breaking the security model of Wayland, the process for identifying the
window is somewhat convoluted, to ensure that only the process launched from the extension can
have those rights. To do so, the extension first generates a random UUID, which will be used
to identify the windows. Then it launches the desktop program (ding.js) with the '-U' parameter
in its command line, and writes the UUID, followed by a carriage return, through the STDIN pipe
of the desktop program. The '-U' parameter instructs the desktop program to wait for that UUID
in its STDIN pipe (it is done this way to allow to run the desktop program in stand-alone mode
for debugging purposes). This way, the UUID is passed through a secure channel, ensuring that
no other program can read it and use it before the legit desktop program. Passing it using the
command line would be very insecure because all programs can read it using the '/proc' virtual
filesystem.

Now the extension monitors all 'map' signals, and when a window with the UUID chosen as the start
of its title is mapped (it also must have a blank space and the monitor number, since there is
one window per monitor), it knows that it is the desktop window. It stores that window object,
enables the 'stick' property to make it appear in all desktops, sends it to the bottom of the
stack, and connects to three signals:

* raised: it is called every time the window is sent to the front, so in the callback, the extension
sends it again to the bottom.
* position-changed: although the window doesn't have titlebar, it still is possible to move it using
Alt+F7, or pressing Super and dragging it with the mouse, so this callback returns the window to the
right possition every time the user tries to move it.
* unmanaged: called when the window disappears. It deletes the UUID, and waits for the desktop program
to be killed (it will be relaunched again by the extension, and, of course, a new UUID will be used).

The extension also intercepts three Gnome Shell system calls, in order to hide the desktop windows
from the tab switcher and the Activities mode. These are 'Meta.Display.get_tab_list()',
'Shell.Global.get_window_actors()', and 'Meta.Workspace.list_windows()'.

## Launching the Desktop Icons application stand-alone

It is possible to launch the desktop icons application in stand-alone mode to do debugging and
testing, but, of course, it will behave as a classic Gtk program: there will be a window with its
titlebar, and the background won't be transparent (it could be, but since the idea is to do debug,
it is better this way). To do so, just launch './ding.js' from the repository directory. If it can't
find the schemas file, just enter the 'schemas' folder and type 'glib-compile-schemas .', and retry.

It accepts the following command line parameters:

* -P: specifies the working path. If not set, it will default to './', which means that all the other
files must be in the current path.
* -D: specifies a monitor. It is followed by another parameter in the form: X:Y:W:H:Z being each letter
      a number with, respectively:
    * X: the X coordinate of this monitor
    * Y: the Y coordinate of this monitor
    * W: the width in pixels of this monitor
    * H: the height in pixels of this monitor
    * Z: the zoom value for this monitor
  you can set several -D parameters in the same command line, one for each monitor. A single window
  will be created for each monitor. If no -D parameter is specified, it will create a single monitor
  with a size of 1280x720 pixels.


## Build with Meson

The project uses a build system called [Meson](https://mesonbuild.com/). You can install
in most Linux distributions as "meson".

It's possible to read more information in the Meson docs to tweak the configuration if needed.

For a regular use and local development these are the steps to build the
project and install it:

```bash
meson --prefix=$HOME/.local/ --localedir=share/gnome-shell/extensions/ding@rastersoft.com/locale .build
ninja -C .build install
```

It is strongly recommended to delete the destination folder
($HOME/.local/share/gnome-shell/extensions/ding@rastersoft.com) before doing this, to ensure that no old
data is kept.

## Export extension ZIP file for extensions.gnome.org

To create a ZIP file with the extension, just run:

```bash
./export-zip.sh
```

This will create the file `ding@rastersoft.com.zip` with the extension, following the rules for publishing at extensions.gnome.org.

## Source code and contacting the author

Sergio Costas  
https://gitlab.com/rastersoft/desktop-icons-ng  
rastersoft@gmail.com  
