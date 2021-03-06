#!/usr/bin/env node

const vorpal = require('vorpal')();
const fs = require('fs');

global.rpcprovider="https://fury.network/rpc";
var StromDAOBO = require("stromdao-businessobject");    
var srequest = require('sync-request');

require('dotenv').config();

var cmd_sign=function(args,callback) {
	var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});		
	var signature= node.sign(args.value);
	vorpal.log(signature);	
	if(typeof callback != "undefined") callback();
	return signature;
}

var cmd_verify=function(args,callback) {
	var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});		
	verification=node.verify(args.options.h);	
	vorpal.log(verification);	
	if(typeof callback != "undefined") callback();
	return verification;
}
var cmd_signer=function(args,callback) {
	var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});			
	vorpal.log(node.wallet.address);	
	if(typeof callback != "undefined") callback();
	return node.wallet.address();
}

var cmd_receipt=function(args,callback) {	
	if(typeof args.options.ipfs != "undefined") { 
		const IPFS = require('ipfs');
		const ipfs = new IPFS();
	}
	var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});
	
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
						node.stromkontoproxy(global.smart_contract_stromkonto).then(function(sko) {
							sko.addTx(tx,json.by,session.value.bonus,session.value.power).then(function(rx) {
								var rcpt={};
								rcpt.ipfs_hash=ipfs_hash;
								rcpt.bc=tx;
								rcpt.tx=rx;
								rcpt.blg=global.smart_contract_stromkonto;
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
		node.stromkontoproxy(global.smart_contract_stromkonto).then(function(sko) {
			sko.addTx(session.start.gsi.by,json.by,session.value.bonus,session.value.power).then(function(rx) {
				var rcpt={};
				rcpt.ipfs_hash="none";
				rcpt.bc=session.start.gsi.by;
				rcpt.tx=rx;
				rcpt.blg=global.smart_contract_stromkonto;
				if(typeof args.options.c != "undefined") { fs.writeFileSync(args.options.f+".contrl",JSON.stringify(rcpt)); } else { vorpal.log(rcpt); }
				callback();
			});
		});					
		
	}
}

var cmd_eei=function(args,callback) {	
	logging=vorpal.log;
	vorpal.log=function(msg){};
	var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});	
	var last_update=node.storage.getItemSync("entsoe_update");
	if((typeof last_update == "undefined")||(last_update==null)||(last_update<new Date().getTime()-13200000)) {
			cmd_fetchentsoe(args,cmd_eei);
	} else {		
		var json=JSON.parse(node.storage.getItemSync("entsoe_data")).periods;
		var data2=srequest("GET","https://stromdao.de/crm/service/tarif/?plz="+args.options.p+"&gp=2&ap=3").body.toString();	
		var tarif=JSON.parse(data2);
		
		if(typeof args.options.n != "undefined") {
			var nj=[];
			json.forEach(function(a,b) {
				a.price={};
				a.price.microCentPerWh=(tarif.ap*1000000);		

				a.value=args.options.n*a.eei;	
				a.price.microCentPerWh=(tarif.ap*1000000)-(args.options.n*(a.eei/100));				
				
				a.price.microCentPerHour=Math.round((tarif.gp*100000000)/8760);
				a.price.centPerWh=Math.round(a.price.microCentPerWh/1000000);
				a.price.cashback=Math.round((args.options.n*(a.eei/100)));
				nj.push(a);
			});
			json=nj;
		}
		if(typeof args.options.s != "undefined") {
				var signed={};
				var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});	
				var msg={};
				msg.time=new Date().getTime();		
				msg.timestamp=new Date(msg.time).toLocaleString();
				msg.plz=args.options.p;		
				msg.tarif={};
				msg.tarif.centPerKWh=tarif.ap;
				msg.tarif.microCentPerHour=Math.round((tarif.gp*100000000)/8760);
				msg.tarif.microCentPerWh=tarif.ap*1000000;
				msg.tarif.microCentBonusPerKWh=args.options.n;
				msg.tarif.centPerYear=tarif.gp*1200;						
				msg.offer=json;
				msg.eei=JSON.stringify(json);			
				signed.hash=node.hash(msg);
				args.value=msg;
				signed.signature=cmd_sign(args);
				signed.data=msg;
				signed.by=node.wallet.address;
				json=signed;		
		}	
		vorpal.log=logging;
		vorpal.log(JSON.stringify(json));
		if(typeof callback == "function") { callback(); }		 
		return json;		
	}
}

var cmd_fetchentsoe=function(args,callback) {
   require("entsoe-api");        
   vorpal.log=function(msg){};
   
   //var data2=srequest("GET","https://stromdao.de/crm/service/tarif/?plz="+args.options.p+"").body.toString();	
   
   var entsoeApi = new ENTSOEapi(process.env.ENTSO_WEB_API);
   entsoeApi.webkey=process.env.ENTSO_WEB_API;
   periodstart=new Date();
   periodstart.setDate(periodstart.getDate());

   periodend=new Date();
   periodend.setDate(periodstart.getDate()+2);
   
   var defaults= {
		outBiddingZone_Domain:'10Y1001A1001A83F',
		biddingZone_Domain:'10Y1001A1001A83F',
		in_Domain:'10Y1001A1001A83F',
		out_Domain:'10Y1001A1001A83F',
		periodStart:ENTSOEapi.buildPeriod(periodstart),
		periodEnd:ENTSOEapi.buildPeriod(periodend)
   }
   var query = new ENTSOEapi.query(defaults);
   // Retrieve Load 
   var res={};
   
   entsoeApi.getData(query.dayAheadTotalLoadForecast(),function(data) {				
		var ret=ENTSOEapi.parseData(data);	
		ret=ret.replace("undefined:1","");
		// 3 mal TimeSeries[0] Fix entfernt			
		try {
			res.start=new Date(JSON.parse(ret).GL_MarketDocument["time_Period.timeInterval"].start).getTime();
			res.end=new Date(JSON.parse(ret).GL_MarketDocument["time_Period.timeInterval"].end).getTime();		
		} catch(e) {
			console.log(ret);
			console.log("Error",e);
			var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});	
			var last_update=node.storage.setItemSync("entsoe_update",new Date().getTime()-3200000);
			if(typeof callback!="undefined") callback(args,null);
		}
		res.periods=[];
		var doc=JSON.parse(ret);
		if(doc.GL_MarketDocument.TimeSeries instanceof Array) {			
			doc.GL_MarketDocument.TimeSeries=doc.GL_MarketDocument.TimeSeries[doc.GL_MarketDocument.TimeSeries.length-1];
		}
		var p=doc.GL_MarketDocument.TimeSeries.Period.Point;
		for(var i=0;i<p.length;i++) {
				var r = {};
				r.time=res.start+(i*900000);
				r.load=p[i].quantity*1;
				res.periods.push(r);			
		}
		var q_solar=query.dayAheadGenerationForecastWindAndSolar();
		q_solar.psrType="B16";		
		entsoeApi.getData(q_solar,function(data) {			
			var ret=ENTSOEapi.parseData(data);	
			ret=ret.replace("undefined:1","");	
			var doc=JSON.parse(ret);
			console.log(doc);
			if(doc.GL_MarketDocument.TimeSeries instanceof Array) {			
					doc.GL_MarketDocument.TimeSeries=doc.GL_MarketDocument.TimeSeries[doc.GL_MarketDocument.TimeSeries.length-1];
			}								
			if(res.start!=new Date(doc.GL_MarketDocument.TimeSeries.Period.timeInterval.start).getTime()) {
				console.log("ERR: Periods do not match!");
				callback();
			} else {
				var p=doc.GL_MarketDocument.TimeSeries.Period.Point;
				for(var i=0;i<p.length;i++) {
						res.periods[i].solar=p[i].quantity*1;
				}
				var q_wind=query.dayAheadGenerationForecastWindAndSolar();
				q_wind.psrType="B19";
				entsoeApi.getData(q_wind,function(data) {						
					var ret=ENTSOEapi.parseData(data);		
					ret=ret.replace("undefined:1","");		
					var doc=JSON.parse(ret);
					if(doc.GL_MarketDocument.TimeSeries instanceof Array) {			
							doc.GL_MarketDocument.TimeSeries=doc.GL_MarketDocument.TimeSeries[doc.GL_MarketDocument.TimeSeries.length-1];
					}				
					if(res.start!=new Date(doc.GL_MarketDocument.TimeSeries.Period.timeInterval.start).getTime()) {
						console.log("ERR: Periods do not match!");
						callback();
					} else {						
						var p=doc.GL_MarketDocument.TimeSeries.Period.Point;
						for(var i=0;i<p.length;i++) {
								res.periods[i].wind=p[i].quantity*1;
								res.periods[i].eei=Math.round(((res.periods[i].wind+res.periods[i].solar)/res.periods[i].load)*100);
						}
						var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});	
						var last_update=node.storage.setItemSync("entsoe_update",new Date().getTime());										
						var entsoe_data=node.storage.setItemSync("entsoe_data",JSON.stringify(res));
						if(typeof callback!="undefined") callback(args,null);
					}
				});
			}						
		});
		
		
	});
}
var cmd_gsi=function(args,callback) {	
	logging=vorpal.log;
	vorpal.log=function(msg){};
	var data=srequest("GET","https://mix.stromhaltig.de/gsi/json/idx/"+args.options.p+".json").body.toString();	
	var data2=srequest("GET","https://stromdao.de/crm/service/tarif/?plz="+args.options.p+"").body.toString();	
	var json=JSON.parse(data);
	var tarif=JSON.parse(data2);
	if(typeof args.options.n != "undefined") {
		var nj=[];
		json.forEach(function(a,b) {
			a.price={};
			a.price.microCentPerWh=(tarif.ap*1000000);		
				
			if(a.eevalue>70) {
				a.value=args.options.n*a.eevalue;	
				a.price.microCentPerWh=(tarif.ap*1000000)-(args.options.n*(a.eevalue/100));				
			} else {
				a.value=0;
			}
			a.price.microCentPerHour=Math.round((tarif.gp*100000000)/8760);
			a.price.centPerWh=Math.round(a.price.microCentPerWh/1000000);
			nj.push(a);
		});
		json=nj;
	}
	if(typeof args.options.s != "undefined") {
			var signed={};
			var node = new StromDAOBO.Node({external_id:"stromdao-mp",testMode:true,rpc:global.rpcprovider});	
			var msg={};
			msg.time=new Date().getTime();		
			msg.plz=args.options.p;		
			msg.tarif={};
			msg.tarif.centPerKWh=tarif.ap;
			msg.tarif.microCentPerHour=Math.round((tarif.gp*100000000)/8760);
			msg.tarif.microCentPerWh=tarif.ap*1000000;
			msg.tarif.microCentBonusPerKWh=args.options.n;
			msg.tarif.centPerYear=tarif.gp*1200;			
			msg.offer=json;
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
  .command('eei')    
  .description("Renewable Energy Index Germany") 
  .option('-s','Sign Index')
  .option('-p <plz>', 'Zip Code of City')
  .option('-n <value>','Value of sur charge')
  .types({
    string: ['p']
  })   
  .action(cmd_eei);	  
  
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

