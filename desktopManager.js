/* ADIEU: Another Desktop Icons Extension for GNOME Shell
 *
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;

const FileItem = imports.fileItem;
const DesktopGrid = imports.desktopGrid;
const DesktopIconsUtil = imports.desktopIconsUtil;
const Prefs = imports.prefs;
const Enums = imports.enums;
const DBusUtils = imports.dbusUtils;
const AskNamePopup = imports.askNamePopup;

const Gettext = imports.gettext.domain('adieu');

const _ = Gettext.gettext;

var DesktopManager = GObject.registerClass({
    Properties: {
        'writable-by-others': GObject.ParamSpec.boolean(
            'writable-by-others',
            'WritableByOthers',
            'Whether the desktop\'s directory can be written by others (o+w unix permission)',
            GObject.ParamFlags.READABLE,
            false
        )
    }
}, class DesktopManager extends GObject.Object {
    _init(appUuid, desktopList, scale, codePath) {
        super._init();

        Gtk.init(null);
        DBusUtils.init();
        this._appUuid = appUuid;
        this._scale = scale;
        this._desktopFilesChanged = false;
        this._readingDesktopFiles = true;
        let desktopDir = DesktopIconsUtil.getDesktopDir();
        this._monitorDesktopDir = desktopDir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        this._monitorDesktopDir.set_rate_limit(1000);
        this._monitorDesktopDir.connect('changed', (obj, file, otherFile, eventType) => this._updateDesktopIfChanged(file, otherFile, eventType));
        this._settingsId = Prefs.settings.connect('changed', () => {
            Gtk.main_quit(); // will be reloaded automagically
        });
        this._gtkSettingsId = Prefs.gtkSettings.connect('changed', (obj, key) => {
            if (key == 'show-hidden') {
                Gtk.main_quit(); // will be reloaded automagically
            }
        });

        this._rubberband = false;

        let cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_file(Gio.File.new_for_path(GLib.build_filenamev([codePath, "stylesheet.css"])));
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), cssProvider, 600);

        this._selectColor = DesktopIconsUtil.getGtkClassBackgroundColor('view', Gtk.StateFlags.SELECTED);

        let cssProviderSelection = new Gtk.CssProvider();
        let style = `.desktop-icons-selected {
    background-color: rgba(${this._selectColor.red * 255},${this._selectColor.green * 255}, ${this._selectColor.blue * 255}, 0.6);
}`;
        cssProviderSelection.load_from_data(style);
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), cssProviderSelection, 600);

        this._window = new Gtk.Window();
        this._window.set_title(appUuid);
        this._window.set_resizable(false);
        this._window.set_decorated(false);
        this._window.set_deletable(false);
        // Do not destroy window when closing
        this._window.connect('delete-event', () => {return true;});

        // this only works on X11, so... let's keep uniformity :-)
        //this._window.set_keep_below(true);
        //this._window.set_skip_pager_hint(true);
        //this._window.set_skip_taskbar_hint(true);
        //this._window.set_type_hint(Gdk.WindowTypeHint.DESKTOP);
        this._eventBox = new Gtk.EventBox({visible: true});
        this._container = new Gtk.Fixed();
        this._window.add(this._eventBox);
        this._eventBox.add(this._container);

        // Transparent background
        this._window.set_app_paintable(true);
        let screen = this._window.get_screen();
        let visual = screen.get_rgba_visual();
        if (visual && screen.is_composited()) {
            this._window.set_visual(visual);
            this._window.connect('draw', (widget, cr) => this._doDraw(cr));
        }

        this._desktops = [];
        let x1, y1, x2, y2;
        x1 = desktopList[0].x;
        x2 = desktopList[0].x + desktopList[0].w;
        y1 = desktopList[0].y;
        y2 = desktopList[0].y + desktopList[0].h;
        for(let desktop of desktopList) {
            if (x1 > desktop.x) {
                x1 = desktop.x;
            }
            if (y1 > desktop.y) {
                y1 = desktop.y;
            }
            if (x2 < (desktop.x + desktop.w)) {
                x2 = desktop.x + desktop.w;
            }
            if (y2 < (desktop.y + desktop.h)) {
                y2 = desktop.y + desktop.h;
            }
        }
        for(let desktop of desktopList) {
            this._desktops.push(new DesktopGrid.DesktopGrid(this, this._container, desktop.x, desktop.y, desktop.w, desktop.h, x1, y1, scale));
        }
        this._window.set_default_size(x2 - x1, y2 - y1);
        this._window.show_all();
        this._eventBox.connect('button-press-event', (actor, event) => this._onPressButton(actor, event));
        this._eventBox.connect('motion-notify-event', (actor, event) => this._onMotion(actor, event));
        this._eventBox.connect('button-release-event', (actor, event) => this._onReleaseButton(actor, event));
        this._createDesktopBackgroundMenu();
        DBusUtils.NautilusFileOperationsProxy.connect('g-properties-changed', this._undoStatusChanged.bind(this));
        this._fileList = [];
        this._readFileList();
    }

    _onPressButton(actor, event) {
        let button = event.get_button()[1];
        let [a, x, y] = event.get_coords();
        let state = event.get_state()[1];

        if (button == 1) {
            let shiftPressed = !!(state & Gdk.ModifierType.SHIFT_MASK);
            let controlPressed = !!(state & Gdk.ModifierType.CONTROL_MASK);
            if (!shiftPressed && !controlPressed) {
                // clear selection
                for(let item of this._fileList) {
                    item.unsetSelected();
                }
            }
            this._startRubberband(x, y);
        }

        if (button == 3) {
            this._menu.popup_at_pointer(event);
            this._syncUndoRedo();
            let atom = Gdk.Atom.intern('CLIPBOARD', false);
            let clipboard = Gtk.Clipboard.get(atom);
            clipboard.request_text((clipboard, text) => {
                let [valid, is_cut, files] = this._parseClipboardText(text);
                this._pasteMenuItem.set_sensitive(valid);
            });
        }

        return false;
    }

    _syncUndoRedo() {
        switch (DBusUtils.NautilusFileOperationsProxy.UndoStatus) {
            case Enums.UndoStatus.UNDO:
                this._undoMenuItem.show();
                this._redoMenuItem.hide();
                break;
            case Enums.UndoStatus.REDO:
                this._undoMenuItem.hide();
                this._redoMenuItem.show();
                break;
            default:
                this._undoMenuItem.hide();
                this._redoMenuItem.hide();
                break;
        }
    }

    _undoStatusChanged(proxy, properties, test) {
        if ('UndoStatus' in properties.deep_unpack())
            this._syncUndoRedo();
    }

    _doUndo() {
        DBusUtils.NautilusFileOperationsProxy.UndoRemote(
            (result, error) => {
                if (error)
                    throw new Error('Error performing undo: ' + error.message);
            }
        );
    }

    _doRedo() {
        DBusUtils.NautilusFileOperationsProxy.RedoRemote(
            (result, error) => {
                if (error)
                    throw new Error('Error performing redo: ' + error.message);
            }
        );
    }

    _onKeyPress(actor, event) {
        if (global.stage.get_key_focus() != actor)
            return false;

        let symbol = event.get_key_symbol();
        let isCtrl = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) != 0;
        let isShift = (event.get_state() & Clutter.ModifierType.SHIFT_MASK) != 0;
        if (isCtrl && isShift && [Clutter.Z, Clutter.z].indexOf(symbol) > -1) {
            this._doRedo();
            return true;
        }
        else if (isCtrl && [Clutter.Z, Clutter.z].indexOf(symbol) > -1) {
            this._doUndo();
            return true;
        }
        else if (isCtrl && [Clutter.C, Clutter.c].indexOf(symbol) > -1) {
            this._desktopManager.doCopy();
            return true;
        }
        else if (isCtrl && [Clutter.X, Clutter.x].indexOf(symbol) > -1) {
            this._desktopManager.doCut();
            return true;
        }
        else if (isCtrl && [Clutter.V, Clutter.v].indexOf(symbol) > -1) {
            this._doPaste();
            return true;
        }
        else if (symbol == Clutter.Return) {
            this._desktopManager.doOpen();
            return true;
        }
        else if (symbol == Clutter.Delete) {
            this._desktopManager.doTrash();
            return true;
        } else if (symbol == Clutter.F2) {
            // Support renaming other grids file items.
            this._desktopManager.doRename();
            return true;
        }
        return false;
    }

    _createDesktopBackgroundMenu() {
        this._menu = new Gtk.Menu();
        let newFolder = new Gtk.MenuItem({label: _("New Folder")});
        newFolder.connect("activate", () => this._newFolder());
        this._menu.add(newFolder);

        this._menu.add(new Gtk.SeparatorMenuItem());

        this._pasteMenuItem = new Gtk.MenuItem({label: _("Paste")});
        this._pasteMenuItem.connect("activate", () => this._doPaste());
        this._menu.add(this._pasteMenuItem);

        this._undoMenuItem = new Gtk.MenuItem({label: _("Undo")});
        this._undoMenuItem.connect("activate", () => this._doUndo());
        this._menu.add(this._undoMenuItem);

        this._redoMenuItem = new Gtk.MenuItem({label: _("Redo")});
        this._redoMenuItem.connect("activate", () => this._doRedo());
        this._menu.add(this._redoMenuItem);

        this._menu.add(new Gtk.SeparatorMenuItem());

        this._showDesktopInFilesMenuItem = new Gtk.MenuItem({label: _("Show Desktop in Files")});
        this._showDesktopInFilesMenuItem.connect("activate", () => this._onOpenDesktopInFilesClicked());
        this._menu.add(this._showDesktopInFilesMenuItem);

        this._openTerminalMenuItem = new Gtk.MenuItem({label: _("Open in Terminal")});
        this._openTerminalMenuItem.connect("activate", () => this._onOpenTerminalClicked());
        this._menu.add(this._openTerminalMenuItem);
        this._menu.show_all();

        /*this._menu.add(new Gtk.SeparatorMenuItem());

        this._changeBackgroundMenuItem = new Gtk.MenuItem({label: _("Change Background…")});
        this._changeBackgroundMenuItem.connect("activate", () => 'gnome-background-panel.desktop');
        this._menu.add(this._changeBackgroundMenuItem);

        this._menu.add(new Gtk.SeparatorMenuItem());

        this._displaySettingsMenuItem = new Gtk.MenuItem({label: _("Display Settings")});
        this._displaySettingsMenuItem.connect("activate", () => 'gnome-display-panel.desktop');
        this._menu.add(this._displaySettingsMenuItem);

        this._settingsMenuItem = new Gtk.MenuItem({label: _("Settings")});
        this._settingsMenuItem.connect("activate", () => this._Clicked());
        this._menu.add(this._MenuItem);*/

    }

    _onOpenDesktopInFilesClicked() {
        Gio.AppInfo.launch_default_for_uri_async(DesktopIconsUtil.getDesktopDir().get_uri(),
            null, null,
            (source, result) => {
                try {
                    Gio.AppInfo.launch_default_for_uri_finish(result);
                } catch (e) {
                   log('Error opening Desktop in Files: ' + e.message);
                }
            }
        );
    }

    _onOpenTerminalClicked() {
        let desktopPath = DesktopIconsUtil.getDesktopDir().get_path();
        DesktopIconsUtil.launchTerminal(desktopPath);
    }

    _doPaste() {
        let atom = Gdk.Atom.intern('CLIPBOARD', false);
        let clipboard = Gtk.Clipboard.get(atom);
        clipboard.request_text((clipboard, text) => {
            let [valid, is_cut, files] = this._parseClipboardText(text);
            if (!valid) {
                return;
            }

            let desktopDir = DesktopIconsUtil.getDesktopDir().get_uri();
            if (is_cut) {
                DBusUtils.NautilusFileOperationsProxy.MoveURIsRemote(files, desktopDir,
                    (result, error) => {
                        if (error)
                            throw new Error('Error moving files: ' + error.message);
                    }
                );
            } else {
                DBusUtils.NautilusFileOperationsProxy.CopyURIsRemote(files, desktopDir,
                    (result, error) => {
                        if (error)
                            throw new Error('Error copying files: ' + error.message);
                    }
                );
            }
        });
    }

    _parseClipboardText(text) {
        if (text === null)
            return [false, false, null];

        let lines = text.split('\n');
        let [mime, action, ...files] = lines;

        if (mime != 'x-special/nautilus-clipboard')
            return [false, false, null];

        if (!(['copy', 'cut'].includes(action)))
            return [false, false, null];
        let isCut = action == 'cut';

        /* Last line is empty due to the split */
        if (files.length <= 1)
            return [false, false, null];
        /* Remove last line */
        files.pop();

        return [true, isCut, files];
    }

    _onMotion(actor, event) {
        if (this._rubberband) {
            let [a, x, y] = event.get_coords();
            this._mouseX = x;
            this._mouseY = y;
            this._window.queue_draw();
            let x1 = Math.min(x, this._rubberbandInitX);
            let x2 = Math.max(x, this._rubberbandInitX);
            let y1 = Math.min(y, this._rubberbandInitY);
            let y2 = Math.max(y, this._rubberbandInitY);
            for(let item of this._fileList) {
                item.updateRubberband(x1, y1, x2, y2);
            }
        }
        return false;
    }

    _onReleaseButton(actor, event) {
        if (this._rubberband) {
            this._rubberband = false;
            for(let item of this._fileList) {
                item.endRubberband();
            }
        }
        this._window.queue_draw();
        return false;
    }

    _startRubberband(x, y) {
        this._rubberbandInitX = x;
        this._rubberbandInitY = y;
        this._mouseX = x;
        this._mouseY = y;
        this._rubberband = true;
        for(let item of this._fileList) {
            item.startRubberband(x, y);
        }
    }

    selected(fileItem, action) {
        switch(action) {
        case Enums.Selection.ALONE:
            for(let item of this._fileList) {
                if (item === fileItem) {
                    item.setSelected();
                } else {
                    item.unsetSelected();
                }
            }
            break;
        case Enums.Selection.WITH_SHIFT:
            fileItem.toggleSelected();
            break;
        case Enums.Selection.RIGHT_BUTTON:
            if (!fileItem.isSelected) {
                for(let item of this._fileList) {
                    if (item === fileItem) {
                        item.setSelected();
                    } else {
                        item.unsetSelected();
                    }
                }
            }
            break;
        case Enums.Selection.ENTER:
            if (this._rubberband) {
                fileItem.setSelected();
            }
            break;
        }
    }

    _doDraw(cr) {
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({red: 0.0, green: 0.0, blue: 0.0, alpha: 0.0}));
        cr.paint();
        if (this._rubberband) {
            cr.rectangle(this._rubberbandInitX,
                         this._rubberbandInitY,
                         this._mouseX - this._rubberbandInitX,
                         this._mouseY - this._rubberbandInitY);
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({
                                                        red: this._selectColor.red,
                                                        green: this._selectColor.green,
                                                        blue: this._selectColor.blue,
                                                        alpha: 0.6}));
            cr.fill();
        }
        return false;
    }

    _readFileList() {
        this._readingDesktopFiles = true;
        this._fileList = [];
        let desktopDir = DesktopIconsUtil.getDesktopDir();
        let fileEnum;
        do {
            this._desktopFilesChanged = false;
            fileEnum = desktopDir.enumerate_children(Enums.DEFAULT_ATTRIBUTES,
                                                     Gio.FileQueryInfoFlags.NONE,
                                                     null);
        } while(this._desktopFilesChanged);
        this._readingDesktopFiles = false;

        for (let [newFolder, extras] of DesktopIconsUtil.getExtraFolders()) {
            this._fileList.push(new FileItem.FileItem(this,
                                                      newFolder,
                                                      newFolder.query_info(Enums.DEFAULT_ATTRIBUTES, Gio.FileQueryInfoFlags.NONE, null),
                                                      extras,
                                                      this._scale));
        }
        let info;
        while ((info = fileEnum.next_file(null))) {
            this._fileList.push(new FileItem.FileItem(this,
                                                      fileEnum.get_child(info),
                                                      info,
                                                      Enums.FileType.NONE,
                                                      this._scale));
        }
        let outOfDesktops = [];
        let notAssignedYet = [];
        // First, add those icons that fit in the current desktops
        for(let icon of this._fileList) {
            if (icon.savedCoordinates == null) {
                notAssignedYet.push(icon);
                continue;
            }
            let [itemX, itemY] = icon.savedCoordinates;
            let addedToDesktop = false;
            for(let desktop of this._desktops) {
                if (desktop.getDistance(itemX, itemY) == 0) {
                    addedToDesktop = true;
                    desktop.addFileItemCloseTo(icon, itemX, itemY, Enums.StoredCoordinates.PRESERVE);
                    break;
                }
            }
            if (!addedToDesktop) {
                outOfDesktops.push(icon);
            }
        }
        // Now, assign those icons that are outside the current desktops,
        // but have assigned coordinates
        for(let icon of outOfDesktops) {
            let minDistance = -1;
            let [itemX, itemY] = icon.savedCoordinates;
            let newDesktop = null;
            for (let desktop of this._desktops) {
                let distance = desktop.getDistance(itemX, itemY);
                if (distance == -1) {
                    continue;
                }
                if ((minDistance == -1) || (distance < minDistance)) {
                    minDistance = distance;
                    newDesktop = desktop;
                }
            }
            if (newDesktop == null) {
                print("Not enough space to add icons");
                break;
            } else {
                newDesktop.addFileItemCloseTo(icon, itemX, itemY, Enums.StoredCoordinates.PRESERVE);
            }
        }
        // Finally, assign those icons that still don't have coordinates
        for (let icon of notAssignedYet) {
            for (let desktop of this._desktops) {
                let distance = desktop.getDistance(0, 0);
                if (distance != -1) {
                    desktop.addFileItemCloseTo(icon, 0, 0, Enums.StoredCoordinates.ASSIGN);
                    break;
                }
            }
        }
    }

    _updateDesktopIfChanged(file, otherFile, eventType) {
        if(this._readingDesktopFiles) {
            // just notify that the files changed while being read from the disk.
            this._desktopFilesChanged = true;
            return;
        }
        // For now, while I'm implementing things like all the menu options, and selection
        // just exit to make the extension reload it again and refresh the desktop
        Gtk.main_quit();
    }

    _getCurrentSelection() {
        let listToTrash = [];
        for(let fileItem of this._fileList) {
            if (fileItem.isSelected) {
                listToTrash.push(fileItem.file.get_uri());
            }
        }
        if (listToTrash.length != 0) {
            return listToTrash;
        } else {
            return null;
        }
    }

    _getClipboardText(isCopy) {
        let selection = this._getCurrentSelection();
        if (selection) {
            let atom = Gdk.Atom.intern('CLIPBOARD', false);
            let clipboard = Gtk.Clipboard.get(atom);
            let text = 'x-special/nautilus-clipboard\n' + (isCopy ? 'copy' : 'cut') + '\n';
            for (let item of selection) {
                text += item + '\n';
            }
            clipboard.set_text(text, -1);
        }
    }

    doCopy() {
        this._getClipboardText(true);
    }

    doCut() {
        this._getClipboardText(false);
    }

    doTrash() {
        let selection = this._getCurrentSelection();
        if (selection) {
            DBusUtils.NautilusFileOperationsProxy.TrashFilesRemote(listToTrash,
                (source, error) => {
                    if (error)
                        throw new Error('Error trashing files on the desktop: ' + error.message);
                }
            );
        }
    }

    doEmptyTrash() {
        DBusUtils.NautilusFileOperationsProxy.EmptyTrashRemote( (source, error) => {
            if (error)
                throw new Error('Error trashing files on the desktop: ' + error.message);
        });
    }

    checkIfSpecialFilesAreSelected() {
        for(let item of this._fileList) {
            if (item.isSelected && item.isSpecial) {
                return true;
            }
        }
        return false;
    }

    getNumberOfSelectedItems() {
        let count = 0;
        for(let item of this._fileList) {
            if (item.isSelected) {
                count++;
            }
        }
        return count;
    }

    doRename(fileitem) {
        let renameWindow = new AskNamePopup.AskNamePopup(fileitem.fileName, _("Rename"), this._window);
        let newName = renameWindow.run();
        if (newName) {
            DBusUtils.NautilusFileOperationsProxy.RenameFileRemote(fileitem.file.get_uri(),
                                                                   newName,
            (result, error) => {
                if (error)
                    throw new Error('Error renaming file: ' + error.message);
            }
        );
        }
    }
});
