var path = require('path'),
    MBTiles = require('mbtiles'),
    MetatileBasedTile = require(path.join(kosmtik.src, 'back/MetatileBasedTile.js')).Tile,
    zoomLatLngToXY = require(path.join(kosmtik.src, 'back/GeoUtils.js')).zoomLatLngToXY,
    BaseExporter = require(path.join(kosmtik.src, 'plugins/base-exporters/Base.js')).BaseExporter;

class TilesExporter extends BaseExporter {

    export(callback) {
        var bounds, self = this;
        if (this.options.bounds) bounds = this.options.bounds.split(',').map(function (x) {return +x;});
        else bounds = this.project.mml.bounds;
        if (!this.options.output) return this.log('Missing destination file. Use --output <path/to/file.mbtiles>');
        this.log('Starting MBTiles export to', this.options.output);
        if (this.options.minZoom > this.options.maxZoom) return this.log('Invalid zooms');
        this.log('Starting MBTiles export, with bounds', bounds, 'and from zoom', this.options.minZoom, 'to', this.options.maxZoom);
        var metadata = {
            name: this.project.id,
            type: 'baselayer',
            version: '1.0.0',
            description: this.project.mml.description || '',
            format: 'png',
            bounds: bounds,
            minzoom: this.options.minZoom,
            maxzoom: this.options.maxZoom
        }
        new MBTiles(this.options.output, function (err, mbtiles) {
            if (err) throw err;
            var done = 0,
                commit = function (err) {
                    if (err) throw err;
                    if (++done === (self.options.maxZoom - self.options.minZoom + 1)) mbtiles.stopWriting(function (err) {if (err) throw err;});
                }
            mbtiles.startWriting(function (err) {
                if (err) throw err;
                mbtiles.putInfo(metadata, function (err) {
                    if (err) throw err;
                    var mapPool = self.project.createMapPool();
                    for (var i = self.options.minZoom; i <= self.options.maxZoom; i++) {
                        self.processZoom(i, bounds, mapPool, mbtiles, self.project, commit);
                    }
                    // Should we drain mapPool even if we are in a script?
                });
            });
        });
    };

    processZoom(zoom, bounds, mapPool, mbtiles, project, cb) {
        var leftTop = zoomLatLngToXY(zoom, bounds[3], bounds[0]),
            rightBottom = zoomLatLngToXY(zoom, bounds[1], bounds[2]),
            self = this, done = 0;
        this.log('Processing zoom', zoom);
        var count = (rightBottom[0] - leftTop[0] + 1) * (rightBottom[1] - leftTop[1] + 1);
        this.log(count, 'tiles to process');
        var commit = function (err) {
            if (err) cb(err);
            if(++done === count) cb();
        };
        for (var x = leftTop[0]; x <= rightBottom[0]; x++) {
            for (var y = leftTop[1]; y <= rightBottom[1]; y++) {
                self.processTile(zoom, x, y, mapPool, mbtiles, project, commit);
            }
        }
    };

    processTile(zoom, x, y, mapPool, mbtiles, project, cb) {
        mapPool.acquire(function (err, map) {
            if (err) throw err;
            var tile = new MetatileBasedTile(zoom, x, y, {metatile: project.mml.metatile});
            return tile.render(project, map, function (err, im) {
                if (err) throw err;
                im.encode('png', function (err, buffer) {
                    if (err) throw err;
                    mbtiles.putTile(zoom, x, y, buffer, function (err) {
                        mapPool.release(map);
                        cb(err);
                    });
                });
            });
        });
    };
}

exports = module.exports = { Exporter: TilesExporter };
