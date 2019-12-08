# History of versions #

* Version 0.7.0 (2019/12/08)
      * Don't show ".desktop" in enabled .desktop files
      * Appearance more consistent with Nautilus
      * Allows to permanently delete files
      * When clicking on a text script, honors "executable-text-activation" setting and, if set, asks what to do
      * Honors "show-image-thumbnails" setting
      * .desktop files are now launched with the $HOME folder as the current folder
      * Allows to run script files with blank spaces in the file name
      * Shows an error if Nautilus is not available in the system
      * Shows an error if a file or folder can't be permanently deleted

* Version 0.6.0 (2019/10/29)
      * Fix icon distribution in the desktop
      * Show the "Name" field in the .desktop files
      * Better wrap of the names
      * Show a tooltip with the filename
      * Show a hand mouse cursor on "single click" policy
      * Add "delete permanently" option
      * Shift + Delete do "delete permanently"
      * Better detection of screen size change
      * Show symlink emblem also in .desktop files and in files with preview
      * Fix "symlink in all icons" bug
      * Ensure that all the emblems fit in the icon

* Version 0.5.0 (2019/10/15)
      * Fix right-click menu in trash not showing sometimes
      * Fix opening a file during New folder operation
      * Changed license to GPLv3 only

* Version 0.4.0 (2019/10/04)
      * Fix Drag'n'Drop in some special cases
      * Don't relaunch the desktop process when disabling and enabling fast
      * Temporary fix for X11 size

* Version 0.3.0 (2019/09/17)
      * Separate Wayland and X11 paths
      * When a file is dropped from another window, it is done at the cursor
      * Fixed bug when dragging several files into a Nautilus window

* Version 0.2.0 (2019/08/19)
      * Shows the full filename if selected
      * Use theme color for selections
      * Sends debug info to the journal
      * Now kills fine old, unneeded processes
      * Allows to launch the desktop app as standalone
      * Ensures that the desktop is kept at background when switching workspaces
      * Honors the Scale value (for retina-like monitors)
      * Hotkeys
      * Check if the desktop folder is writable by others
      * Now the settings window doesn't block the icons
      * Don't show hidden files

* Version 0.1.0 (2019/08/13)
      * First semi-working version version
      * Has everything supported by Desktop Icons, plus Drag'n'Drop
