/*jslint node: true*/
(function (exports) {
	"use strict";
	
	var fs = require("fs"),
		_ = require("underscore"),
		pathUtil = require("path"),
		parser = require("./parser.js");

	var createDependencyStack = function (directory, filename, srcPaths, reference, callback, stack, processedFiles) {
		var path = pathUtil.normalize(directory + "/" + filename);
        
		stack = stack || [];
		processedFiles = processedFiles || [];
	
		if (_.contains(processedFiles, path)) {
			// path is already processed; continue
			callback(stack);
			return;
		}
		// processedFiles just holds all files for which processing has been started
		processedFiles.push(path);
	
		fs.readFile(path, function (err, data) {
			if (err) {
				console.error("file '" + path + "' referenced from " + reference + " not found");
				callback(stack);
				return;
			}
			var deps = parser.parse(data.toString()),
				loopOverDependencies = function () {
					if (deps.dependencies.length) {
                        
						var dep = deps.dependencies.shift(), // pop first element of array
							depPath = getDependencyPath( dep, srcPaths, directory );
                        
						createDependencyStack(
							pathUtil.dirname(depPath), 
							pathUtil.basename(depPath), 
                            srcPaths,
							path, 
							loopOverDependencies, 
							stack, 
							processedFiles
						);
					} else {
                        stack.push(addClassPathAndImports( path, srcPaths, deps.imports ));
                        
                        //Don't trigger callback, move on to dealing with looping over  'uses' declarations
						loopOverUses();
					}
				},
                loopOverUses = function(){
                    if (deps.uses.length) {
                        
						var dep = deps.uses.shift(), // pop first element of array
							depPath = getDependencyPath( dep, srcPaths, directory );
                        
						createDependencyStack(
							pathUtil.dirname(depPath), 
							pathUtil.basename(depPath), 
                            srcPaths,
							path, 
							loopOverUses, 
							stack, 
							processedFiles
						);
					} else {
                        //stack.push(path); - already in the stack
                        
                        //trigger callback
						callback(stack);
					}
                };
                
            //console.log( "parser found dependencies: "+deps.dependencies+' ('+deps.dependencies.length+')' );
            //console.log( "parser found uses: "+deps.uses+' ('+deps.uses.length+')' );
            
			loopOverDependencies();
            
		});
	};
    
    var addClassPathAndImports = function( directory, srcPaths, imports ){
        //return directory;
        var path = new String( directory );
        
        path.folder = findClassPath( directory, srcPaths );
        path.imports = imports;
        
        return path;
    }
    
    var findClassPath = function( directory, srcPaths ){
        for( var i = 0; i < srcPaths.length; i++ ){
            if( directory.indexOf( srcPaths[i].path ) === 0 ){
                return srcPaths[i];
            }
        }
        
        return false;
        //throw new Error( 'unknown source path: '+directory );
    }
    
    var getDependencyPath = function( dependency, srcPaths, directory ){
        var pathStr,
            path;
        
        //attempt to find this file in the source paths
        dependency = dependency.replace( /\./g, pathUtil.sep )+'.js';
        
        //checking current directory
        path = directory + pathUtil.sep + dependency;
        
        try{
            fs.openSync( path, 'r' );
            
            //if you get here, file exists
            pathStr = path;
            
            //pathStr.folder = findClassPath( directory, srcPaths );//this probably isn't good enough
        } catch(e){}//file does not exist, just swallow error
        
        if( !pathStr ){
            //scan through srcPaths
            for( var i = 0; i < srcPaths.length; i++ ){
                path = srcPaths[i].path + pathUtil.sep + dependency;
                
                try{
                    fs.openSync( path, 'r' );
                    
                    //if you get here, file exists
                    pathStr = path;
                    
                    //pathStr.folder = srcPaths[i];
                    
                    break;
                } catch(e){}//file does not exist, just swallow error
            }
        }
        
        return pathStr;
    };
	
	/*var filterOmittedFiles = function (stack, omitRegExArr) {
		var expressions = _.map(omitRegExArr, function (expr) {
			return new RegExp(expr);
		});
		
		return _.filter(stack, function (file) {
			var keepFile = true;
			expressions.forEach(function (expr) {
				if (file.match(expr)) {
					keepFile = false;
				}
			});
			return keepFile;
		});
	};*/
	
    /*
	var concatenate = function concatenate(stack, callback, omitRegExArr) {
		var output = [],
			completed;
			
		if (omitRegExArr) {
			// filter files to omit
			stack = _.filter(stack, function (file) {
				var keepFile = true;
				omitRegExArr.forEach(function (expr) {
					if (file.match(expr)) {
						keepFile = false;
					}
				});
				return keepFile;
			});
		}
		
		completed = _.after(stack.length, function () {
			callback(output.join("\n"));
		});
			
		stack.forEach(function (path, idx) {
			fs.readFile(path, function (err, data) {
				output[idx * 2] = "// file: " + path;
				output[idx * 2 + 1] = data.toString();
				completed();
			});
		});
	};*/
	/*
	var isInsideRootPath = function checkRootPath(stack, rootPath) {
		var valid = true,
			regEx = new RegExp("^" + rootPath);
		stack.forEach(function (path) {
			if (!path.match(regEx)) {
				valid = false;
			}
		});
		return valid;
	};*/

	exports.createDependencyStack = createDependencyStack;
    exports.findClassPath = findClassPath;
	//exports.concatenate = concatenate;
	//exports.isInsideRootPath = isInsideRootPath;
	//exports.filterOmittedFiles = filterOmittedFiles;
}(this));