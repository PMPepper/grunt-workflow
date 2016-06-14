/*jslint node: true*/
var fs = require("fs"),
	_ = require("underscore");

    
var lineTokenizer = function(data) {
		return data.split( /\r\n|\r|\n/ )
	},
    requireLineFilter = function(line) {
		return !!(line.match(/^\/\/#require/));
	},
    importLineFilter = function(line) {
		return !!(line.match(/^\/\/#import/));
	},
    usesLineFilter = function(line) {
		return !!(line.match(/^\/\/#uses/));
	},
    dependenciesLineFilter = function(line) {
		return !!(line.match(/^\/\/#(require|import)/));
	},
    linePathTokeniser = function( line ){
        //console.log( 'Extracting path from: '+line );
        var result = /\/\/#[a-z]+\s+([^;]+)/.exec( line );
        
        if( result && result.length > 1 ){
            return result[1].trim();
        }
        
        return null;
    };
/*
var lineSeparator = function(data) {
		return data.indexOf("\r\n") > -1 ? "\r\n" : "\n";
	},
	lineTokenizer = function(data) {
		return data.split(lineSeparator(data));
	},
	trim = function (token) {
		return token.trim();
	},
	extractDeps = function (line) {
		var startPos = line.indexOf("\"") + 1,
			endPos = line.lastIndexOf("\"");
		return line.substring(startPos, endPos).split(",");
	},
	requireLineFilter = function(line) {
		return !!(line.match(/^\/\/\s*=\s*require/));
	},
	requireLineTokenizer = function(line) {
		return _.map(
			extractDeps(line),
			trim
		);
	},
	parseSourceCode = function (src) {
		return _.flatten(
			_.map(
				_.filter(
					lineTokenizer(src),
					requireLineFilter
				),
				requireLineTokenizer
			)
		);
	};

this.lineTokenizer = lineTokenizer;
this.lineSeparator = lineSeparator;
this.parse = parseSourceCode;*/

this.parse = function parse( src ){
    var lines = lineTokenizer(src),
        requires = _.map( _.filter( lines, requireLineFilter ), linePathTokeniser ),
        imports = _.map( _.filter( lines, importLineFilter ), linePathTokeniser ),
        uses = _.map( _.filter( lines, usesLineFilter ), linePathTokeniser );
        dependencies = _.map( _.filter( lines, dependenciesLineFilter ), linePathTokeniser );
    
    return { requires:requires, imports:imports, uses:uses, dependencies:dependencies };
}