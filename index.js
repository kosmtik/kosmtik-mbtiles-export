var path = require('path');

class Plugin {
    constructor(config) {
        config.commands.export.option('minZoom', {
            help: 'Min zoom to be considered for export',
            metavar: 'INT',
            default: 0
        });
        config.commands.export.option('maxZoom', {
            help: 'Max zoom to be considered for export',
            metavar: 'INT',
            default: 18
        });
        config.registerExporter('mbtiles', path.join(__dirname, 'Export.js'));
    }
}

exports = module.exports = { Plugin };
