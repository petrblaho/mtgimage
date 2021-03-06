"use strict";
/*global setImmediate: true*/

var base = require("xbase"),
	C = require("C"),
	fileUtil = require("xutil").file,
	imageUtil = require("xutil").image,
	runUtil = require("xutil").run,
	fs = require("fs"),
	mkdirp = require("mkdirp"),
	path = require("path"),
	rimraf = require("rimraf"),
	tiptoe = require("tiptoe");

var MANA_SYMBOL_PATH = path.join(__dirname, "..", "web", "actual", "symbol", "mana");

function usage()
{
	base.error("Usage: node %s <mana key> <symbol.svg>", path.basename(process.argv[1]));
	process.exit(1);
}

if(process.argv.length<4)
	usage();

var manaKey = process.argv[2].toLowerCase();
if(!C.SYMBOL_MANA.hasOwnProperty(manaKey))
{
	base.error("Invalid mana key: %s", manaKey);
	usage();
}

var svgFile = process.argv[3];
if(!fs.existsSync(svgFile))
{
	base.error("File does not exist: %s", svgFile);
	usage();
}

base.info("Importing mana key [%s] from file: %s", manaKey, svgFile);

var TARGET_PATH = path.join(MANA_SYMBOL_PATH, manaKey);
var runOptions = {silent:true};

tiptoe(
	function clearTargetDir()
	{
		rimraf(TARGET_PATH, this);
	},
	function mktargetDir()
	{
		mkdirp(TARGET_PATH, this);
	},
	function getSize()
	{
		imageUtil.getWidthHeight(svgFile, this);
	},
	function generateImages(size)
	{
		var self=this;

		C.SYMBOL_SIZES.forEach(function(SYMBOL_SIZE)
		{
			var targetWidth = SYMBOL_SIZE;
			var targetHeight = SYMBOL_SIZE;
			if(size[0]>size[1])
				targetHeight = Math.round((size[1]*(SYMBOL_SIZE/size[0])));
			else if(size[1]>size[0])
				targetWidth = Math.round((size[0]*(SYMBOL_SIZE/size[1])));

			runUtil.run("inkscape", ["--export-png=" + path.join(TARGET_PATH, SYMBOL_SIZE + ".png"), "--export-width=" + targetWidth, "--export-height=" + targetHeight, svgFile], runOptions, self.parallel());
		});
	},
	function createGIFs()
	{
		var self=this;

		C.SYMBOL_SIZES.forEach(function(SYMBOL_SIZE)
		{
			runUtil.run("convert", [path.join(TARGET_PATH, SYMBOL_SIZE + ".png"), path.join(TARGET_PATH, SYMBOL_SIZE + ".gif")], runOptions, self.parallel());
		});
	},
	function compressImages()
	{
		var self=this;
		C.SYMBOL_SIZES.forEach(function(SYMBOL_SIZE)
		{
			var fileName = path.join(TARGET_PATH, SYMBOL_SIZE + ".png");
			imageUtil.compress(fileName, fileName, false, self.parallel());
		});
	},
	function copySVG()
	{
		fileUtil.copy(svgFile, path.join(TARGET_PATH, "..", manaKey + ".svg"), this);
	},
	function symlink()
	{
		var self=this;
		C.SYMBOL_MANA[manaKey].forEach(function(FULL_SYMBOL)
		{
			fs.symlink(manaKey + ".svg", path.join(path.resolve(TARGET_PATH, ".."), FULL_SYMBOL + ".svg"), self.parallel());
			fs.symlink(manaKey, path.join(path.resolve(TARGET_PATH, ".."), FULL_SYMBOL), self.parallel());
		});
	},
	function finish(err)
	{
		if(err)
		{
			base.error(err);
			process.exit(1);
		}

		process.exit(0);
	}
);