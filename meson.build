project('ding',
  version: '0.24.0',
  license: 'GPL3'
)

gnome = import ('gnome')
i18n = import('i18n')

prefix = get_option('prefix')
datadir = join_paths (prefix, get_option('datadir'))
schema_dir = join_paths(datadir, 'glib-2.0', 'schemas')

extensions_dir = join_paths(prefix, 'share', 'gnome-shell', 'extensions', 'ding@rastersoft.com')

install_data([
    'askRenamePopup.js',
    'createThumbnail.js',
    'dbusUtils.js',
    'desktopGrid.js',
    'desktopIconsUtil.js',
    'desktopManager.js',
    'ding.js',
    'emulateX11WindowType.js',
    'enums.js',
    'extension.js',
    'fileItem.js',
    'fileItemMenu.js',
    'metadata.json',
    'prefs.js',
    'preferences.js',
    'showErrorPopup.js',
    'stylesheet.css',
    'templatesScriptsManager.js',
    'thumbnails.js'
  ],
  install_dir: extensions_dir
)

subdir(
  'po'
)
subdir(
  'schemas'
)

meson.add_install_script('meson_post_install.py')
