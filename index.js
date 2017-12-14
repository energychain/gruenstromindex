#!/usr/bin/env node

const vorpal = require('vorpal')();
const fs = require('fs');

global.rpcprovider="https://fury.network/rpc";
var StromDAOBO = require("stromdao-businessobject");    
var srequest = require('sync-request');


var cmd_sign=function(args,callback) {
	var node = new StromDAOBO.Node({external_id:"signer",testMode:true,rpc:global.rpcprovider});		
	var signature= node.sign(args.value);
	vorpal.log(signature);	
	if(typeof callback != "undefined") callback();
	return signature;
}

var cmd_verify=function(args,callback) {
	var node = new StromDAOBO.Node({external_id:"signer",testMode:true,rpc:global.rpcprovider});		
	verification=node.verify(args.options.h);	
	vorpal.log(verification);	
	if(typeof callback != "undefined") callback();
	return verification;
}
var cmd_signer=function(args,callback) {
	var node = new StromDAOBO.Node({external_id:"signer",testMode:true,rpc:global.rpcprovider});			
	vorpal.log(node.wallet.address);	
	if(typeof callback != "undefined") callback();
	return node.wallet.address();
}

var cmd_receipt=function(args,callback) {	
	if(typeof args.options.ipfs != "undefined") { 
		const IPFS = require('ipfs');
		const ipfs = new IPFS();
	}
	var node = new StromDAOBO.Node({external_id:"signer",testMode:true,rpc:global.rpcprovider});
	
	if((fs.existsSync(args.options.f+".contrl"))||(fs.existsSync(args.options.f+".aperak"))) {
		vorpal.log("ERR: .contrl or .aperak exists for "+args.options.f);
		callback();
		return;
	}
	var json=JSON.parse(fs.readFileSync(args.options.f));
	if(json.hash!=node.hash(json.data)) {
	  vorpal.log("ERR:Hash check failed");
	  if(typeof args.options.c != "undefined") fs.writeFileSync(args.options.f+".aperak",JSON.stringify("Hash"));
	  callback();
	  return;	
	}
	if(json.by!=node.verify(json.signature)) {
	  vorpal.log("ERR:Signer check failed");
	  if(typeof args.options.c != "undefined") fs.writeFileSync(args.options.f+".aperak",JSON.stringify("Signer"));
	  callback();
	  return;	
	}
	var session=JSON.parse(json.data);	
	session.start.gsi=JSON.parse(session.start.gsi);
	session.end.gsi=session.end.gsi;
	
	if(session.start.gsi.hash!=node.hash(session.start.gsi.data)) {
	  vorpal.log("ERR:Hash check failed for Session Start");
	  if(typeof args.options.c != "undefined") fs.writeFileSync(args.options.f+".aperak",JSON.stringify("Hash Session End"));
	  callback();
	  return;	
	}
	
	if(session.end.gsi.hash!=node.hash(session.end.gsi.data)) {
	  vorpal.log("ERR:Hash check failed for Session End");
	  if(typeof args.options.c != "undefined") fs.writeFileSync(args.options.f+".aperak",JSON.stringify("Hash Session End"));
	  callback();
	  return;	
	}

	if(session.start.gsi.by!=node.verify(session.start.gsi.signature)) {
	  vorpal.log("ERR:Signer check failed for Session Start");
	  if(typeof args.options.c != "undefined") fs.writeFileSync(args.options.f+".aperak",JSON.stringify("Signer Session Start"));
	  callback();
	  return;	
	}
	if(session.end.gsi.by!=node.verify(session.end.gsi.signature)) {
	  vorpal.log("ERR:Signer check failed for Session End");
	  if(typeof args.options.c != "undefined") fs.writeFileSync(args.options.f+".aperak",JSON.stringify("Signer Session End"));
	  callback();
	  return;	
	}
	if(session.start.gsi.by!=session.end.gsi.by) {
	  vorpal.log("ERR:Different GSI Signers");
	  if(typeof args.options.c != "undefined") fs.writeFileSync(args.options.f+".aperak",JSON.stringify("GSI Signers differ"));
	  callback();
	  return;
	}
	
	if(typeof args.options.ipfs != "undefined") {
		ipfs.on('ready', () => {
			ipfs.files.add({path:'/receipt.json',content:new ipfs.types.Buffer(JSON.stringify(json),'utf-8')}, function (err, files) {
				var ipfs_hash=files[0].hash;				
				node.stringstoragefactory().then(function(ssf) {
					ssf.build(ipfs_hash).then(function(tx) {
						node.stromkonto("0x19BF166624F485f191d82900a5B7bc22Be569895").then(function(sko) {
							sko.addTx(tx,json.by,session.value.bonus,session.value.ee).then(function(rx) {
								var rcpt={};
								rcpt.ipfs_hash=ipfs_hash;
								rcpt.bc=tx;
								rcpt.tx=rx;
								if(typeof args.options.c != "undefined") { fs.writeFileSync(args.options.f+".contrl",JSON.stringify(rcpt)); } else { vorpal.log(rcpt); }
								callback();
							});
						});					
					});
				});
			});
		});		
	} else {
		var ipfs_hash="none";				
		node.stromkonto("0x19BF166624F485f191d82900a5B7bc22Be569895").then(function(sko) {
			sko.addTx(session.start.gsi.by,json.by,session.value.bonus,session.value.ee).then(function(rx) {
				var rcpt={};
				rcpt.ipfs_hash="none";
				rcpt.bc=session.start.gsi.by;
				rcpt.tx=rx;
				if(typeof args.options.c != "undefined") { fs.writeFileSync(args.options.f+".contrl",JSON.stringify(rcpt)); } else { vorpal.log(rcpt); }
				callback();
			});
		});					
		
	}
}

var cmd_gsi=function(args,callback) {	
	logging=vorpal.log;
	vorpal.log=function(msg){};
	var data=srequest("GET","https://mix.stromhaltig.de/gsi/json/idx/"+args.options.p+".json").body.toString();	
	var json=JSON.parse(data);
	if(typeof args.options.n != "undefined") {
		var nj=[];
		json.forEach(function(a,b) {
			if(a.eevalue>70) {
				a.value=args.options.n*a.eevalue;
			} else {
				a.value=0;
			}
			nj.push(a);
		});
		json=nj;
	}
	if(typeof args.options.s != "undefined") {
			var signed={};
			var node = new StromDAOBO.Node({external_id:"signer",testMode:true,rpc:global.rpcprovider});	
			var msg={};
			msg.time=new Date().getTime();		
			msg.plz=args.options.p;		
			msg.gsi=JSON.stringify(json);			
			signed.hash=node.hash(msg);
			args.value=msg;
			signed.signature=cmd_sign(args);
			signed.data=msg;
			signed.by=node.wallet.address;
			json=signed;		
	}	
	vorpal.log=logging;
	vorpal.log(JSON.stringify(json));
	if(typeof callback != "undefined") callback();
	return json;	
}

vorpal
  .command('signer')    
  .description("Prints current Message Signer")   
  .action(cmd_signer);	
  
vorpal
  .command('sign <value>')    
  .description("Signs a given Value")   
  .action(cmd_sign);	
  
vorpal
  .command('verify')    
  .description("Verify") 
  .option('-h <hash>', 'Hash to verify')
  .types({
    string: ['h']
  })  
  .action(cmd_verify);	
  
vorpal
  .command('receipt')    
  .description("Create receipt of file") 
  .option('-c', 'Create contrl or aperak file')
  .option('-f <filepath>', 'File to create receipt')
  .option('--ipfs','Share on IPFS')
  .types({
    string: ['d']
  })  
  .action(cmd_receipt);	
    
vorpal
  .command('gsi')    
  .description("Get Green Power Index (Germany)") 
  .option('-s','Sign Index')
  .option('-p <plz>', 'Zip Code of City')
  .option('-n <value>','Value of grid benefit')
  .types({
    string: ['p']
  })  
  .action(cmd_gsi);	  

 
var cli = new require("stromdao-cli-helper")(vorpal);	

