// Test the assignment logic directly
const testContent = `abbaert7222@gmail.com Alexander Baert 5:30 PM Re: Alexander, we need your video footage. I have added my week 1-5 highlights as well as a preseason scrimmage. My hudl login information is as follows: Email: abbaert7222@gmail.com Password: @lexbaertHudl3 On Sat, Sep 13, 2025 at 5:54 PM Prospect ID Video videoteam@prospectid.com wrote: 

Hi Alexander and family,  Thank you for your request! You should've received a Google Drive notification from nationalpid@gmail.com. Here's a copy of your GDrive folder:  https://drive.google.com/drive/folders/115OE6yTAaXaP7FOtiXTx8SwsWALHmkyp?usp=drive_link Please limit the number of clips to a maximum of 35 to ensure a faster turnaround time. Let me know when you have uploaded all of your plays, and feel free to reach out if you have any additional questions! Kind Regards, Jerami Singleton Content Creator at National Prospect ID Phone (407) 473-3637 Email videoteam@prospectid.com Web www.nationalpid.com`;

const contentLower = testContent.toLowerCase();

console.log('Testing assignment logic:');
console.log('Content contains "jerami singleton":', contentLower.includes('jerami singleton'));
console.log('Content contains "content creator at national prospect id":', contentLower.includes('content creator at national prospect id'));

if (contentLower.includes('jerami singleton') && contentLower.includes('content creator at national prospect id')) {
    console.log('✅ Should be ASSIGNED');
} else {
    console.log('❌ Should be UNASSIGNED');
}
