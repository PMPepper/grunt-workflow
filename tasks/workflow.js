/*
 * grunt-workflow
 * https://github.com/Paul/js-workflow
 *
 * Copyright (c) 2014 PM Pepper
 * Licensed under the MIT license.
 */

'use strict';

//TODO allow files to be excluded?

module.exports = function(grunt) {
    var io = require("./lib/io.js"),
		fs = require("fs"),
        cheerio = require('cheerio'),
		pathUtil = require("path"),
		_ = require("underscore"),
		pwd = pathUtil.resolve("."),
        mkdirp = require('mkdirp'),
        gccPath = 'C:\\Users\\Paul\\closure\\compiler.jar',
        execFile = require('child_process').execFile;

  grunt.registerMultiTask('workflow', 'My custom JS workflow plugin', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var done = this.async(),
        //omits = grunt.config("resolve.exclude") || {},
        //relativeFiles = grunt.config("resolve.files") || [],
        fileCompleted = _.after(this.data.length, function () {
            done();
        });;
    
    var options = this.options({
      punctuation: '.',
      separator: ', '
    });
    
    //TODO clear out JS dest directories?
    
    this.data.forEach(function(data) {
        var input = fs.readFileSync( data.input ),
            baseDir = pathUtil.dirname(pathUtil.normalize(pwd + pathUtil.sep + data.input)),
            $ = cheerio.load(input);
        
        $( 'comment' ).remove();//remove all comment nodes from generated output
        
        var script, 
            path,
            scripts = [],
            paths = [],
            $scripts = $( 'script[src]' ),
            scriptCompleted,
            srcPath,
            jsDest = pathUtil.normalize(pwd + pathUtil.sep + data.js_dest);
        
        $( 'worker' ).remove();//process nodes are for scripts elements that should be processed, not not included in output
        //Process nodes need to be compiled, OR use require() in the script itself...
        
        $scripts.each( function( index, element ){
            script = this.attribs.src;
            //script = $(this).attr( 'src' );//this should work, doesn't.
            scripts.push( script );
            
            path = pathUtil.normalize(baseDir + pathUtil.sep + script);
            paths.push( path );
        });
        
        scriptCompleted = _.after(scripts.length, function () {
            writeOutputFile();
        });
        
        srcPath = _.map( data.src, function( item ){
            item.path = pathUtil.normalize(pwd + pathUtil.sep + item.path);
            
            return item;
        } );
        
        $scripts.each( function( index, script ){ 
            var $script = $(this);
            var path = paths[index];
            
            var isWorker = $script.parent()[0].name === 'worker';
            
            if( io.findClassPath( pathUtil.dirname(path), srcPath ) ){
                
                grunt.log.writeln('===================================');
                grunt.log.writeln('= scanning file: "' + path + ' =');
                grunt.log.writeln('===================================');
                
                io.createDependencyStack(
                    pathUtil.dirname(path), //directory
                    pathUtil.basename(path), //filename
                    srcPath,
                    "Gruntfile.js", 
                    function (deps) {//deps is list of all files that are dependencies, in order
                        
                        grunt.log.writeln('Dependencies: \n' + deps.join( '\n' ));
                        
                        grunt.log.writeln('===================================');
                        grunt.log.writeln('');
                        
                        //final arguments called after each script is parsed
                        generateOutput( $script, deps, isWorker, scriptCompleted );
                    }
                );
            } else {
                scriptCompleted();//just skip over this file
            }
        } );
        
        function generateOutput( $script, dependencies, isWorker, complete ){
            if( data.dev ){
                if( isWorker ){
                    //need to compile
                    generateConcatedOutput( $script, dependencies, complete );
                } else if( data.local ) {
                    generateLocalDevOutput( $script, dependencies, complete );
                } else {
                    generateDevOutput( $script, dependencies, complete );
                }
            } else {
                generateConcatedOutput( $script, dependencies, complete );
            }
        }
        
        var fakeScriptTag = 'gogogogleoikviohweciwecjfwevc';//stupid workaround
        
        function generateLocalDevOutput( $script, dependencies, complete ){
            dependencies.pop();//Do not need the last item, as that is the starting script file
            
            var $newScript;
            
            for( var i = 0; i < dependencies.length; i++ ){
                $script.before( '<'+fakeScriptTag+' src="file://'+dependencies[i]+'"></'+fakeScriptTag+'>' );
            }
            
            if( complete ){
                complete();
            }
        }
        
        function generateDevOutput( $script, dependencies, complete ){
            var src = dependencies.pop();//Do not need the last item, as that is the starting script file
            
            var path = processSrcFile( src );
            
            $script[0].attribs.src = path.toString();
            
            for( var i = 0; i < dependencies.length; i++ ){
                //need to process the file
                var path = processSrcFile( dependencies[i] );
                
                //now update HTML
                $script.before( '<'+fakeScriptTag+' src="'+path.toString()+'"></'+fakeScriptTag+'>' );
                
                dependencies[i] = new String( dependencies[i] );
                dependencies[i].destUrl = path.toString();
                dependencies[i].destPath = path.path.toString();
                
            }
            
            if( complete ){
                complete();
            }
        }
        
        //TODO configure if should be compiled, or just concatenated
        function generateConcatedOutput( $script, dependencies, complete ){
            //record full details of source
            var srcObj = dependencies[dependencies.length-1];
            
            //copy and process source files
            generateDevOutput( $script, dependencies );
            
            var dest = pathUtil.resolve( pwd + pathUtil.sep + $script[0].attribs.src );
            
            //point to minified output
            $script[0].attribs.src.substr( 0, $script[0].attribs.src.length-2 )+'min.js';
            
            //compiler vars
            var src = srcObj.toString();
            var outputPath = dest.toString().substr( 0, dest.toString().length-2 )+'min.js';
            var outputMap = dest.toString().substr( 0, dest.toString().length-2 )+'min.map';
            
            //compile
            var args = ['-jar', gccPath, '--compilation_level', 'WHITESPACE_ONLY', '--formatting', 'pretty_print', '--warning_level', 'QUIET', '--js_output_file', outputPath, '--create_source_map', outputMap, '--source_map_format=V3', '--language_in=ECMASCRIPT5'];
            
            for( var i = 0; i < dependencies.length; i++ ){
            //for( var i = dependencies.length-1; i > -1; --i ){
                args.push( '--js' );
                args.push( dependencies[i].destPath.toString() );
            }
            
            args.push( '--js' );
            args.push( dest );
            
            console.log( 'java '+ args.join( ' ' ) );
            
            //Test args
            //var args = ['-jar', gccPath, '--help'];
            
            execFile( 'java', args, {}, function (error, stdout, stderr){
                if( error ){
                    console.log( 'Compiler error: '+error );
                    //console.log( stderr );
                } else {
                    console.log( 'GCC Complete' );
                    //console.log( 'GCC Output: '+stdout );
                }
                
                complete();
            } );
            
            //console.log(dependencies)
        }
        
        //TODO move this into external file? No, because I need the imports of this file..
        function processClassFile( file, fileData ){
            fileData = fileData+'';
            var regexp  = /^\/\/#class\s+([^\s]+)( +extends +([^\s]+))?([\s\S]*)/gm
            var fileParts = regexp.exec( fileData );
            
            if( fileParts ){
                //is a class file
                var className = fileParts[1],
                    extendsName = null,
                    classHeader = fileData.substr( 0, fileParts.index ),
                    classBody = fileParts[4];
                
                if( fileParts[3] ){
                    extendsName = fileParts[3];
                }
                
                var classNameParts = className.split( '.' );
                
                fileData = classHeader + 'ACPF.registerClass( \''+ classNameParts.pop() +'\', \''+classNameParts.join( '.' )+'\',' + classBody;
                
                //TODO import string (ACPF.getClassByQualifiedName( "' . $baseClass . '" )';)
                //function(){
                var importStr = '';
                
                if( file.imports && file.imports.length > 0 ){
                    file.imports.forEach( function( importFile ){
                        importStr += 'var '+( importFile.split( '.' ).pop() )+' = ACPF.getClassByQualifiedName( \''+importFile+'\');';
                    });
                }
                
                if( importStr ){
                    fileData = fileData.replace( /function\s*\([^)]*\)\s*{/, function( match ){
                        return match+importStr;
                    } )
                }
                
                //TODO now add self declaration
                fileData = fileData.replace( 'this.constructor = function', 'var Self = this.constructor = function' );
                
                if( extendsName ){
                    fileData += ', ACPF.getClassByQualifiedName( \'' + extendsName + '\' )';
                }
                
                fileData += '\n);';/**/
                
            } else {
                //console.log( 'not a class: '+file.toString() );
            }
            
            
            return fileData;
        }
        
        function processSrcFile( file ){
            var fileData;
            
            try{
                fileData = fs.readFileSync( file+'' );
            }
            catch(e){
                //console.log( e );
                return null;
            }
            
            //process classes/imports
            fileData = processClassFile( file, fileData );
            
            //actually process the file
            if( data.process && data.process.length ){
                data.process.forEach( function( process ){
                    fileData = process( file, fileData );
                } );
            }
            
            if( !file.folder ){
                console.log( 'unknown folder - shouldnt be possible: '+file.toString() );
                
                return '';
            }
            
            var relPath = pathUtil.relative( file.folder.path, file+'' );
            var outputPath = pathUtil.resolve( jsDest + pathUtil.sep + file.folder.name + pathUtil.sep + relPath );
            var outputUrl = data.js_dest+'/'+( file.folder.name ? file.folder.name+'/' : '' )+relPath.replace( /\\/g, '/' );
            
            //write file to output location
            mkdirp.sync( pathUtil.dirname( outputPath ) );
            fs.writeFileSync( outputPath, fileData );
            
            var output = new String( outputUrl );
            output.path = outputPath;
            
            return output;
        }
        
        function writeOutputFile(){
            var html = $.html();
            
            html = html.replace( new RegExp( fakeScriptTag, 'g' ), 'script' );
            
            fs.writeFileSync( data.output, html );
            
            //actually finish for this data item
            fileCompleted();//once this has been called enough, will end
        }
        
        
    });
    
  });

};
