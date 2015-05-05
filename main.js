var fs = require('fs');
var stream = require('stream');
var _ = require('lodash');
var csv = require('fast-csv');
var spawn = require('child_process').spawnSync;
var async = require('async');
var program = require('commander');

// CLI
program.version('0.0.1');
program.option("-l, --list [filename]", "Package list");
program.option("-o, --output [filename]", "Output file");
program.parse(process.argv);

// Hashtable
/*
  packages = Hashtable{ {
    id: int,
    name: string,
    inst: int,
    vote: int,
    old: int,
    recent: int,
    deps: array[String]
  } }
*/
var packages = {};
packages.size = 0;

function getDependencies(obj) {
  deps = spawn('apt-cache', ['-i', 'depends', obj.name]);

  var data = deps.stdout.toString();
  data.split("\n").forEach(function(line){

    var result = depends_regex.exec(line);
    if(result && result.length>1){
      var pkg = result[1];
      obj.deps.push(pkg);
    }

  });
  process.stdout.write("\rReading dependencies... #"+obj.id);
}

// reading CSV
var readFile = fs.createReadStream(program.list);
var depends_regex = new RegExp("Depends: (.*)", "i");

process.stdout.write("Reading packages...");


csv
.fromStream(readFile, {headers : false, delimiter: '\t', comment: '#', trim: true})
.on("data", function(row){

  var obj = {
    id: row[0],
    name: row[1],
    inst: row[2],
    vote: row[3],
    old: row[4],
    recent: row[5],
    deps: []
  };
  packages.size++;

  packages["key-"+obj.name] = obj;

  process.stdout.write("\rReading packages... #"+obj.id);

})
.on("finish", function(){

  process.stdout.write("\rReading packages... DONE.                        \n");

  process.stdout.write("Reading dependencies...");

  Object.keys(packages).forEach(function(key){
      if(key=="size") return;
      getDependencies(packages[key]);
  });

  //

  process.stdout.write("\rReading dependencies... DONE.\n");
  process.stdout.write("Serializing...");
  fs.writeFileSync("mem.json", JSON.stringify(packages));
  process.stdout.write("\rSerializing... DONE.\n");
  console.log("Creating Pajek network with "+packages.size+" vertice(s)");

  var ws = fs.createWriteStream(program.output);
  var arcs_buff = [];
  var inst_buff = [];
  var vote_buff = [];
  var old_buff = [];
  var recent_buff = [];

  ws.write("*Network Package Dependency\n");
  ws.write("*Vertices "+packages.size+"\n");

  arcs_buff.push("*Arcs");

  inst_buff.push("\n*Partition inst");
  inst_buff.push("*Vertices "+packages.size);

  vote_buff.push("\n*Partition vote");
  vote_buff.push("*Vertices "+packages.size);

  old_buff.push("\n*Partition old");
  old_buff.push("*Vertices "+packages.size);

  recent_buff.push("\n*Partition recent");
  recent_buff.push("*Vertices "+packages.size);

  Object.keys(packages).forEach(function(key){

    if(key=="size") { return; }

    var obj = packages[key];
    ws.write(obj.id+" "+obj.name+"ellipse ic red\n");

    // Arcs
    obj.deps.forEach(function(dep){
      try {
        arcs_buff.push(obj.id+" "+packages["key-"+dep].id+" 1");
      } catch(e) {
        // No package was found in the package list to match 'dep'
      }
    });

    // inst vector
    inst_buff.push(obj.inst);

    // vote vector
    vote_buff.push(obj.vote);

    // old vector
    old_buff.push(obj.old);

    // recent vector
    recent_buff.push(obj.recent);


  });
  ws.write(arcs_buff.join("\n"));
  ws.write(inst_buff.join("\n"));
  ws.write(vote_buff.join("\n"));
  ws.write(old_buff.join("\n"));
  ws.write(recent_buff.join("\n"));

});
