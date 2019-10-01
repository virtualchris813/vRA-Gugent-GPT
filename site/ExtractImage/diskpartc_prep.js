// Copyright (c) 2017 VMware, Inc.  All rights reserved.
//////////////////////////////////////////////////
// diskpartc_prep.js
//
// Unlike diskpart_prep.js, this implementation for
// use with WinPE environments cannot use the
// "label" command because it is not available.
//
// This means 32-bit Unicode disk labels are not
// available.
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

eval(include("workitem.js"));
eval(include("script_writer.js"));

/** class ****************************************/

function Disk(letter, offset, size, bag, isPhysical, isSCVMMGen2) {
    this.letter = letter;
    this.offset = offset;
    this.bag = bag;
    this.size = size;
    this.isPhysical = isPhysical;
    this.isSCVMMGen2 = isSCVMMGen2;

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
        var lines = new Array();
        lines.push("select disk " + this.offset);
        lines.push("online disk NOERR");
        lines.push("attribute disk clear readonly NOERR");
       if (this.isSCVMMGen2) {
            lines.push("clean");
            lines.push("convert gpt");
            lines.push("create partition efi size=100");
            lines.push("format fs=\"fat32\" label=System");
            lines.push("Assign Letter=Y:");
        }
        if (this.size > 0 && this.isPhysical) {
            lines.push("create partition primary size=" + this.size);

        }
        else {
            lines.push("clean");
            lines.push("convert gpt");
            lines.push("create partition primary");
        }
        lines.push("format fs=\"" + this.getFileSystem() + "\" label=\"" + this.getLabel() + "\" quick");
        lines.push("Assign Letter=" + this.letter + ":");
        if (!this.isSCVMMGen2) {
            lines.push("active");
        }
		
        return lines.join("\r\n");
    };
}


//////////////////////////////////////////////////
// main

try {
    // just do drive 0 in setupos workitem
    sw = new ScriptWriter("diskpart", ".scr", false);
    bag = new WorkItem("properties.xml");

    var letter;
    var size = 0;
    var percent;
    var wmi = GetObject("winmgmts://./root/cimv2");
    var primaryDiskPercentAvailable = false;
    var isPhysical = false;
    var isSCVMMGen2 = false;

    if (bag.exists("VirtualMachine.Disk0.Letter")) {
       letter = bag.get("VirtualMachine.Disk0.Letter").substr(0, 1).toUpperCase();
    }
    else {
       letter = "C";
    }
    // Check if this interfacetype is SCVMM and VM is SCVMM Gen 2 or not.
    //WScript.Echo("interfacetype is  " + bag.get("interfacetype"));
    if (bag.get("interfacetype") == "Scvmm" && bag.exists("Scvmm.Generation2")) {
       isSCVMMGen2 = true;
       //WScript.Echo("Gen 2 machine");
    }

    //Bug:1055852 'VirtualMachine.Disk0.percent/size' does not pass values to  physical provisioning.
    //if both custom properties('VirtualMachine.Disk0.Percent' or 'VirtualMachine.Disk0.Size') mentioned,we will take
    //'VirtualMachine.Disk0.Percent' proerpty as Precedence otherwise 'VirtualMachine.Disk0.Size' proerpty as Precedence.

    if (bag.exists("VirtualMachine.Disk0.Percent")) {
        percent = bag.get("VirtualMachine.Disk0.Percent");
        percent =parseInt(percent);
        if(percent >0)
        {
            primaryDiskPercentAvailable = true;
            var totalphysicalDisk=0;
            var physicalDisks = new Enumerator(wmi.ExecQuery("SELECT * FROM Win32_DiskDrive"));
            for ( ; !physicalDisks.atEnd(); physicalDisks.moveNext())
            {
                var physicalDisk = physicalDisks.item();
                var strCount = physicalDisk.DeviceID.substring(physicalDisk.DeviceID.search(/[0-9]/));
                if (strCount == "0")
                {
                    var physicalDiskSize = physicalDisk.Size;
                    //totalphysicalDisk size in terms of Bytes and need to convert into MB with percent
                    totalphysicalDisk =parseInt(physicalDiskSize);
                    size =(totalphysicalDisk/(1024*1024))*(percent/100);
                    //To avoid Float numbers while creating primary partition in Disk drive
                    size=parseInt(size);
                    break;
                }
            }
        }
    }

    if (bag.exists("VirtualMachine.Disk0.Size") && !primaryDiskPercentAvailable) {
        size = bag.get("VirtualMachine.Disk0.Size");
        //In Custom Properties Size is mentioned in terms of MB and convert into GB
        size =parseInt(size)*1024;
    }

    if (bag.exists("VirtualMachine.ManagementEndpoint.Name") && bag.get("VirtualMachine.ManagementEndpoint.Name") =="Physical Reservation") {
        isPhysical = true;
    }

    var disk = new Disk(letter, 0, size, bag, isPhysical, isSCVMMGen2);
    sw.write(disk);

} catch (e) {
    throw e;
}
