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

const Gtk = imports.gi.Gtk;
const Gettext = imports.gettext.domain('adieu');

const _ = Gettext.gettext;

var AskNamePopup = class {

    constructor(filename, title, parentWindow) {

        this._window = new Gtk.Dialog({use_header_bar: true});
        this._window.add_button(_("OK"), Gtk.ResponseType.OK);
        this._window.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
        this._window.set_modal(true);
        this._window.set_title(title);
        let contentArea = this._window.get_content_area();
        this._textArea = new Gtk.Entry();
        if (filename) {
            this._textArea.text = filename;
        }
        contentArea.pack_start(this._textArea, true, true, 5);
        this._textArea.connect('activate', () => {
            this._window.response(Gtk.ResponseType.OK);
        });
    }

    run() {
        this._window.show_all();
        let retval = this._window.run();
        this._window.hide();
        if (retval == Gtk.ResponseType.OK) {
            return this._textArea.text;
        } else {
            return null;
        }
    }

        /*this._renameEntry = new St.Entry({ hint_text: _("Enter file name…"),
                                           can_focus: true,
                                           x_expand: true });
        this._renameEntry.clutter_text.connect('activate', this._onRenameAccepted.bind(this));
        this._renameOkButton= new St.Button({ label: _("OK"),
                                              style_class: 'app-view-control button',
                                              button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE,
                                              reactive: true,
                                              can_focus: true,
                                              x_expand: true });
        this._renameCancelButton = new St.Button({ label: _("Cancel"),
                                                   style_class: 'app-view-control button',
                                                   button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE,
                                                   reactive: true,
                                                   can_focus: true,
                                                   x_expand: true });
        this._renameCancelButton.connect('clicked', () => { this._onRenameCanceled(); });
        this._renameOkButton.connect('clicked', () => { this._onRenameAccepted(); });
        let renameButtonsBoxLayout = new Clutter.BoxLayout({ homogeneous: true });
        let renameButtonsBox = new St.Widget({ layout_manager: renameButtonsBoxLayout,
                                               x_expand: true });
        renameButtonsBox.add_child(this._renameCancelButton);
        renameButtonsBox.add_child(this._renameOkButton);

        let renameContentLayout = new Clutter.BoxLayout({ spacing: 6,
                                                          orientation: Clutter.Orientation.VERTICAL });
        let renameContent = new St.Widget({ style_class: 'rename-popup',
                                            layout_manager: renameContentLayout,
                                            x_expand: true });
        renameContent.add_child(this._renameEntry);
        renameContent.add_child(renameButtonsBox);

        this._boxPointer = new BoxPointer.BoxPointer(St.Side.TOP, { can_focus: false, x_expand: false });
        this.actor = this._boxPointer.actor;
        this.actor.style_class = 'popup-menu-boxpointer';
        this.actor.add_style_class_name('popup-menu');
        this.actor.visible = false;
        this._boxPointer.bin.set_child(renameContent);
*/

    _popup() {

        this.emit('open-state-changed', true);
    }

    _popdown() {
        this.emit('open-state-changed', false);
    }

    onFileItemRenameClicked(fileItem) {
        this._source = fileItem;

        this._renameEntry.text = fileItem.displayName;

        this._popup();
        this._renameEntry.navigate_focus(null, Gtk.DirectionType.TAB_FORWARD, false);
        let extensionOffset = DesktopIconsUtil.getFileExtensionOffset(fileItem.displayName, fileItem.isDirectory);
        this._renameEntry.clutter_text.set_selection(0, extensionOffset);
    }

    _onRenameAccepted() {
        this._popdown();
        DBusUtils.NautilusFileOperationsProxy.RenameFileRemote(this._source.file.get_uri(),
                                                               this._renameEntry.get_text(),
            (result, error) => {
                if (error)
                    throw new Error('Error renaming file: ' + error.message);
            }
        );
    }

    _onRenameCanceled() {
        this._popdown();
    }
};

