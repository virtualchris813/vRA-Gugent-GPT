// Copyright (c) 2017 VMware, Inc.  All rights reserved.
//////////////////////////////////////////////////
// diskpart.js
//
// @author: Christopher Boumenot

/** utility **************************************/

function include(filename) {
    var fso = new ActiveXObject("Scripting.FileSystemObject");
    var f = fso.OpenTextFile(filename);
    var s = f.ReadAll();
    f.Close();
    return s;
};

/** include **************************************/

eval(include("drive_letters.js"));
eval(include("workitem1.js"));
eval(include("script_writer.js"));

/** class ****************************************/

function Disk(letter, offset, bag) {
    this.letter = letter;
    this.offset = offset;
    this.bag = bag;

    this.getFileSystem = function() {
        var name = "VirtualMachine.Disk" + this.offset + ".FileSystem";
        if (bag.exists(name)) {
            return bag.get(name);
        }

        return "ntfs";
    };

    this.getLabel = function() {
        var name = "VirtualMachine.Disk" + this.offset + ".Label";
        if (bag.exists(name)) {
            return bag.get(name);
        }
        
        return this.letter + " Drive";
    };

    this.toString = function() {
        // XP version of diskpart has fewer commands (e.g. no format)
        // so check for XP (major version = 5) and don't send those commands
        var WshShell = WScript.CreateObject("WScript.Shell");
        var osver = WshShell.RegRead("HKLM\\Software\\Microsoft\\Windows NT\\CurrentVersion\\CurrentVersion");
        var majorVer = osver.substring(0, 1);
        var lines = new Array();
        lines.push("select disk " + this.offset);
        if (majorVer >= 6) {
            lines.push("online disk NOERR");
            lines.push("attribute disk clear readonly NOERR");
        }
        lines.push("clean");
        lines.push("convert gpt");
        lines.push("create partition primary");
        if (majorVer >= 6) {
            lines.push("format fs=\"" + this.getFileSystem() + "\" label=\"" + this.getLabel() + "\" quick");
        }

        lines.push("Assign Letter=" + this.letter + ":");

        //if (offset == 0) {
            lines.push("active");
        //}

        return lines.join("\r\n");
    };
}


//////////////////////////////////////////////////
// main

try {
    dl = new DriveLetters();
    sw = new ScriptWriter("diskpart", ".scr", false);
    bag = new WorkItem("..\\workitem.xml");
	var keys = bag.getkeys();

    // var wmi = GetObject("winmgmts:\\\\.\\root\\cimv2");    
    var wmi = GetObject("winmgmts://./root/cimv2");    

    // Iterate over the machine's disks and
    //  - create a new partition
    //  - activate
    //  - assign letter
    //  - format
    var physicalDisks = new Enumerator(wmi.ExecQuery("SELECT * FROM Win32_DiskDrive"));
    for ( ; !physicalDisks.atEnd(); physicalDisks.moveNext()) {

        var physicalDisk = physicalDisks.item();
		var strCount = physicalDisk.DeviceID.substring(physicalDisk.DeviceID.search(/[0-9]/));
		
		if (strCount == "0") {
			continue;
		}

		var foundIt = false;
		for (var ii = 0; ii < keys.length; ii++) {
			if (keys[ii].indexOf("virtualmachine.disk" + strCount) == 0) {
				foundIt = true;
				break;
			}
		}
			
		if (!foundIt) {
			continue;
		}
        var letter;
        var driveLetter = "VirtualMachine.Disk" + strCount + ".Letter";
        if (bag.exists(driveLetter)) {
            letter = bag.get(driveLetter).substr(0, 1).toUpperCase();
            dl.allocate(letter);
        }
        else {
            letter = dl.getNextLocal();
        }
        
        var disk = new Disk(letter, parseInt(strCount), bag);
        sw.write(disk);
    }
} catch (e) {
    throw e;
}

