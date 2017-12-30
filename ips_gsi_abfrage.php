<?
/**
 Strompreis Abfrage für dynamische Tarife
 ============================================================================
 Dieses Script ruft die dynamischen Tarife von https://stromhaltig.de/ 
 durch Änderung der Abruffunktion "fetchSignal" kann allerdings auch jeder
 andere Anbieter von dynamischen Tarifen verwendet werden.
 
 Idee des Scripts ist es, zu zeigen, wie man Strompreise in einer 
 Automatisierung verwenden kann, um Schaltzeiten zu optimieren.
 
 Selbstverstöndlich kann dieses Script auch für eigene Versuche getestet
 werden, auch wenn man selbst keinen dynamischen Stromtarif hat.
 
 Limitierungen:
 Signatur wird nicht geprüft! D.h. über die Tarifapi wird ein Angebot 
 abgerufen, aber nicht geprüft ob dieses Angebot tatsächlich vom 
 Stromanbieter stammt. Da wir bei https Abrufen vertrauen darauf, dass
 der Inhaber der Domain gültig ist, ist dies auch nicht zwingend notwendig
 
 Fragen und Anregungen:
 Bitte bei Fragen direkt an thorsten.zoerner@stromdao.com schreiben, oder
 per PM im Symcon-Forum Benutzername: zoernert
 
*/

function setUpdateSchedule() {	
	if(!IPS_GetEventIDByName("Verarbeite GSI",$_IPS['SELF'])) {
		$EreignisID=IPS_CreateEvent ( 1 );
		IPS_SetParent($EreignisID, $_IPS['SELF']); 
		IPS_SetEventActive($EreignisID, true);
		IPS_SetName($EreignisID,"Verarbeite GSI");
		IPS_SetEventCyclic ($EreignisID, 0,0,0,0,3,1);		
	}
}

function setSlots($indicator,$values) {
	  SetValue(getVariableID($indicator." Zeitpunkt",3), date("d.m.y H:i",$values->epochtime));
	  SetValue(getVariableID($indicator." Unix Time",1),$values->epochtime);    
	  SetValue(getVariableID($indicator." Grünstromindex",1),$values->eevalue);      
	  SetValue(getVariableID($indicator." Arbeitspreis (Cent)",2),$values->price->centPerWh);
	  SetValue(getVariableID($indicator." Grundpreis (Cent)",2),$values->price->microCentPerHour/100000);  
	  SetValue(getVariableID($indicator." Gesamtpreis je KWh",2),(($values->price->microCentPerWh/10)+$values->price->microCentPerHour)/100000);  
}

function processSignal() {
  $signal=json_decode(GetValue(getVariableID("raw_signal",3)));
  if(!isset($signal->data)) {
	 fetchSignal(GetValueString(getVariableID("Postleitzahl",3)));  
	 processSignal(); 
  }
  $ts=time();
  $current=$signal->data->offer[0];
  $best=$signal->data->offer[0];
  $worst=$signal->data->offer[0];
  $i=0;  
  foreach($signal->data->offer as $o) { 
  		if($o->epochtime<$ts) {  $current=$o; $i++; } else {
			if($o->eevalue>$best->eevalue) $best=$o;
			if($o->eevalue<$worst->eevalue) $worst=$o;
		} 		
  }         
  if($i>6) fetchSignal(GetValueString(getVariableID("Postleitzahl",3)));
  if(time()<$current->epochtime+7200) {
		setSlots("Aktuell",$current);
  } else {
      echo "FEHLER: Letzter Wert im Grünstromindex zu alt (".(time()-($current->epochtime+7200))." Sekunden)"; 
      SetValue(getVariableID("Aktuell Zeitpunkt",3), "-");
	  SetValue(getVariableID("Aktuell Unix Time",1),0);    
	  SetValue(getVariableID("Aktuell Grünstromindex",1),50);  

  }
  setSlots("Grün",$best);
  setSlots("Grau",$worst);  
}

function fetchSignal($plz) {
  $signal_raw=file_get_contents("https://stromdao.de/crm/service/gsi/?plz=".$plz);  
  SetValueString(getVariableID("raw_signal",3),$signal_raw);
}

function getVariableID($name,$type) {
   $id=0;
   if(!IPS_GetObjectIDByName($name,$_IPS['SELF'])) {
      $id=IPS_CreateVariable($type);
	  IPS_SetName($id,$name);
	  IPS_SetParent($id,$_IPS["SELF"]);
   } else {
   	$id=IPS_GetObjectIDByName($name,$_IPS['SELF']);
   }
   return $id;
}


// Generelle Aktualisierungs Logik

$plz=GetValueString(getVariableID("Postleitzahl",3));
if(sizeof($plz)!=5) { 
	$plz="69256"; 
	SetValueString(getVariableID("Postleitzahl",3),$plz);
}
setUpdateSchedule();
processSignal();
?>
