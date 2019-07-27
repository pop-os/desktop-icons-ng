const GObject = imports.gi.GObject;

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
    _init(params) {
        super._init(params);
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
