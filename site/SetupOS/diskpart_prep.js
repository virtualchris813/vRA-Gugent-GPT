// Copyright (c) 2017 VMware, Inc.  All rights reserved.
//////////////////////////////////////////////////
// diskpart_prep.js
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

function Disk(letter, offset, bag, majorVer) {
    this.letter = letter;
    this.offset = offset;
    this.bag = bag;
    this.majorVer = majorVer;

    this.getFileSystem = function() {
        var name = "VirtualMachine.Disk" + this.offset + ".FileSystem";
        if (bag.exists(name)) {
            return bag.get(name);
        }

        return "ntfs";
    };

    this.toString = function() {
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
            lines.push("format fs=\"" + this.getFileSystem() + "\" quick");
        }
        lines.push("Assign Letter=" + this.letter + ":");

        if (offset == 0) {
            lines.push("active");
        }

        return lines.join("\r\n");
    };
}

function Label(letter, offset, bag, majorVer) {
    this.letter = letter;
    this.offset = offset;
    this.bag = bag;
    this.majorVer = majorVer;

    this.getLabel = function() {
        var name = "VirtualMachine.Disk" + this.offset + ".Label";
        if (bag.exists(name)) {
            return bag.get(name);
        }

        return this.letter + " Drive";
    };

    this.toString = function() {
        var lines = new Array();
        lines.push(this.letter + ":" + this.getLabel());
        return lines.join("\r\n");
    };
}


//////////////////////////////////////////////////
// main

try {
    // XP version of diskpart has fewer commands (e.g. no format)
    // so check for XP (major version = 5) and don't send those commands
    var WshShell = WScript.CreateObject("WScript.Shell");
    var osver = WshShell.RegRead("HKLM\\Software\\Microsoft\\Windows NT\\CurrentVersion\\CurrentVersion");
    var majorVer = osver.substring(0, 1);

    dl = new DriveLetters();
    sw = new ScriptWriter("diskpart", ".scr", false);
    swUnicodeLabel = new ScriptWriter("disklabel", ".scr", true);
    bag = new WorkItem("..\\workitem.xml");
    var keys = bag.getkeys();


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

        // don't try to partition if this is a cloned disk
        if (bag.exists("VirtualMachine.disk" + strCount + ".isclone")) {
	        if (bag.get("VirtualMachine.disk" + strCount + ".isclone").toLowerCase() == "true") {
				continue;
			}
        }

        var letter;
        var driveLetter = "VirtualMachine.Disk" + strCount + ".Letter";
        if (bag.exists(driveLetter)) {
            letter = bag.get(driveLetter).substr(0, 1).toUpperCase();
            if (!dl.isAllocated(letter)) {
                dl.allocate(letter);
            }
            else {
                letter = dl.getNextLocal();
            }
        }
        else {
            letter = dl.getNextLocal();
        }
        
        var disk = new Disk(letter, parseInt(strCount), bag, majorVer);
        sw.write(disk);

        if (majorVer >= 6) {
            var label = new Label(letter, parseInt(strCount), bag, majorVer);
            swUnicodeLabel.write(label);
        }

    }
} catch (e) {
    throw e;
}

