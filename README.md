# vRA-Gugent-GPT
This repo contains modified vRA Windows guest agent files that will have the guest agent partition Windows drives as GPT instead of MBR. This is an all or nothing config, it is not selectable. These changes are used at your own risk and are not supported or endorsed by VMware. 

To use these files, build your template as you normally would. Run the prepare template script as usual and then overlay these files into the C:\VRMGuestAgent\site directory. Shut down your template VM, convert it back to a template and use as you normally would. This overlay needs to happen anytime you re-run the prepare template script. 

The following directories conain files that are modified:<br>
C:\VRMGuestAgent\site\Customize<br>
C:\VRMGuestAgent\site\CustomizeGuestOS<br>
C:\VRMGuestAgent\site\CustomizeOS<br>
C:\VRMGuestAgent\site\ExtractImage<br>
C:\VRMGuestAgent\site\InstallOS<br>
C:\VRMGuestAgent\site\Partition<br>
C:\VRMGuestAgent\site\SetupDisks<br>
C:\VRMGuestAgent\site\SetupOS<br>
