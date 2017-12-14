#!/usr/bin/env node

const vorpal = require('vorpal')();
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

var cmd_gsi=function(args,callback) {	
	logging=vorpal.log;
	vorpal.log=function(msg){};
	var data=srequest("GET","https://mix.stromhaltig.de/gsi/json/idx/"+args.options.p+".json").body.toString();	
	var json=JSON.parse(data);
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
	vorpal.log(json);
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
  .command('gsi')    
  .description("Get Green Power Index (Germany)") 
  .option('-s','Sign Index')
  .option('-p <plz>', 'Zip Code of City')
  .types({
    string: ['p']
  })  
  .action(cmd_gsi);	  

 
var cli = new require("stromdao-cli-helper")(vorpal);	

