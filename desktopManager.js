/**
 * Desktop Icons NG
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
    _init(appUuid, desktopList, scale) {
        super._init();

        Gtk.init(null);
        this._appUuid = appUuid;
        this._scale = scale;
        this._desktopFilesChanged = false;
        this._readingDesktopFiles = true;
        let desktopDir = DesktopIconsUtil.getDesktopDir();
        this._monitorDesktopDir = desktopDir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        this._monitorDesktopDir.set_rate_limit(1000);
        this._monitorDesktopDir.connect('changed', (obj, file, otherFile, eventType) => this._updateDesktopIfChanged(file, otherFile, eventType));

        this._window = new Gtk.Window();
        this._window.set_title(appUuid);
        this._window.set_resizable(false);
        this._window.set_decorated(false);
        this._window.set_deletable(false);
        //this._window.set_keep_below(true);
        //this._window.set_skip_pager_hint(true);
        //this._window.set_skip_taskbar_hint(true);
        //this._window.set_type_hint(Gdk.WindowTypeHint.DESKTOP);
        this._eventBox = new Gtk.EventBox({visible: true});
        this._container = new Gtk.Fixed();
        this._window.add(this._eventBox);
        this._eventBox.add(this._container);
        this._window.set_app_paintable(true);
        let screen = this._window.get_screen();
        let visual = screen.get_rgba_visual();
        if (visual && screen.is_composited()) {
            this._window.set_visual(visual);
        }
        this._window.connect('draw', (widget, context) => this.exposeDraw(widget, context) );

        this._desktops = [];
        let x1, y1, x2, y2;
        x1 = desktopList[0].x;
        x2 = desktopList[0].x + desktopList[0].w;
        y1 = desktopList[0].y;
        y2 = desktopList[0].y + desktopList[0].h;
        for(let desktop of desktopList) {
            this._desktops.push(new DesktopGrid.DesktopGrid(this._container, desktop.x, desktop.y, desktop.w, desktop.h, scale));
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
        this._window.set_default_size(x2 - x1, y2 - y1);
        this._window.show_all();
        this._fileList = [];
        this._readFileList();
    }

    run() {
        Gtk.main();
    }

    exposeDraw(window, cr) {

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({red: 0.0, green: 0.0, blue: 0.0, alpha:0.0}));
        cr.paint();

        return false;
    }

    _readFileList() {
        this._desktopFilesChanged = false;
        this._readingDesktopFiles = true;
        this._fileList = [];
        let desktopDir = DesktopIconsUtil.getDesktopDir();
        desktopDir.enumerate_children_async(DesktopIconsUtil.DEFAULT_ATTRIBUTES,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (source, result) => {
                try {
                    let fileEnum = source.enumerate_children_finish(result);
                    if (this._desktopFilesChanged) {
                        print("Files changed while being read. Retrying.");
                        this._readFileList();
                    } else {
                        for (let [newFolder, extras] of DesktopIconsUtil.getExtraFolders()) {
                            this._fileList.push(new FileItem.FileItem(this,
                                                                    newFolder,
                                                                    newFolder.query_info(DesktopIconsUtil.DEFAULT_ATTRIBUTES, Gio.FileQueryInfoFlags.NONE, null),
                                                                    extras,
                                                                    this._scale));
                        }
                        let info;
                        while ((info = fileEnum.next_file(null))) {
                            this._fileList.push(new FileItem.FileItem(this,
                                                                    fileEnum.get_child(info),
                                                                    info,
                                                                    Prefs.FileType.NONE,
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
                                    desktop.addFileItemCloseTo(icon, itemX, itemY, DesktopGrid.StoredCoordinates.PRESERVE);
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
                                newDesktop.addFileItemCloseTo(icon, itemX, itemY, DesktopGrid.StoredCoordinates.PRESERVE);
                            }
                        }
                        // Finally, assign those icons that still don't have coordinates
                        for (let icon of notAssignedYet) {
                            for (let desktop of this._desktops) {
                                let distance = desktop.getDistance(0, 0);
                                if (distance != -1) {
                                    desktop.addFileItemCloseTo(icon, 0, 0, DesktopGrid.StoredCoordinates.ASSIGN);
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    print("Error reading the desktop files. Retrying. " + e);
                    this._readFileList();
                }
            });
    }

    _updateDesktopIfChanged(file, otherFile, eventType) {
        this._desktopFilesChanged = true;
    }

    doCopy() {
        print("Do copy");
    }

    doCut() {
        print("Do cut");
    }

    doTrash() {
        print("Do trash");
    }

    doEmptyTrash() {
        print("Do empty trash");
    }

    checkIfSpecialFilesAreSelected() {
        return true;
    }

    getNumberOfSelectedItems() {
        return 1;
    }
});
