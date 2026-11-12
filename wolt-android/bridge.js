import { Browser } from '@capacitor/browser';
window.woltOpenUrl = (url) => Browser.open({url,toolbarColor:'#102638'});
