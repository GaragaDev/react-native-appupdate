'use strict';

import {
  NativeModules,
  Platform,
} from 'react-native';
import RNFS from 'react-native-fs';
import RNFetchBlob from 'react-native-fetch-blob';

const RNAppUpdate = NativeModules.RNAppUpdate;

const jobId = -1;

class AppUpdate {
  constructor(options) {
    this.options = options;
  }

  GET(url, success, error) {
    fetch(url)
      .then((response) => response.json())
      .then((json) => {
        success && success(json);
      })
      .catch((err) => {
        error && error(err);
      });
  }

  getApkVersion() {
    if (jobId !== -1) {
      return;
    }
    if (!this.options.apkVersionUrl) {
      console.log("apkVersionUrl doesn't exist.");
      return;
    }
    this.GET(this.options.apkVersionUrl, this.getApkVersionSuccess.bind(this), this.getVersionError.bind(this));
  }

  getApkVersionSuccess(remote) {
    console.log("getApkVersionSuccess", remote);
    if (RNAppUpdate.versionName !== remote.versionName) {
      if (remote.forceUpdate) {
        if(this.options.forceUpdateApp) {
          this.options.forceUpdateApp();
        }
        this.downloadApk(remote);
      } else if (this.options.needUpdateApp) {
        this.options.needUpdateApp((isUpdate) => {
          if (isUpdate) {
            this.downloadApk(remote);
          }
        });
      }
    } else if(this.options.notNeedUpdateApp) {
      this.options.notNeedUpdateApp();
    }
  }

  downloadApk(remote) {
    const progress = (received, total) => {
      console.warn('Written ', received);
      console.warn('Length ', total);
      const percentage = ((100 * received) / total) | 0;
      this.options.downloadApkProgress && this.options.downloadApkProgress(percentage);
    };
    const begin = (res) => {
      console.log("downloadApkStart");
      this.options.downloadApkStart && this.options.downloadApkStart();
    };
    const progressDivider = 1;
    const downloadDestPath = `${RNFS.DocumentDirectoryPath}/NewApp.apk`;

    begin();    
    RNFetchBlob
    .config({
      // add this option that makes response data to be stored as a file,
      // this is much more performant.
      path: downloadDestPath
    })
    .fetch('GET', remote.apkUrl, {
      //some headers ..
    })
    .progress((received, total) => progress(received, total))
    .then((res) => {
      // the temp file path
      console.log("downloadApkEnd");
      this.options.downloadApkEnd && this.options.downloadApkEnd();
      RNAppUpdate.installApk(downloadDestPath);

    })
    .catch((err) => {
      this.downloadApkError(err);      
    })
  }

  getAppStoreVersion() {
    if (!this.options.iosAppId) {
      console.log("iosAppId doesn't exist.");
      return;
    }
    this.GET("https://itunes.apple.com/lookup?id=" + this.options.iosAppId, this.getAppStoreVersionSuccess.bind(this), this.getVersionError.bind(this));
  }

  getAppStoreVersionSuccess(data) {
    if (data.resultCount < 1) {
      console.log("iosAppId is wrong.");
      return;
    }
    const result = data.results[0];
    const version = result.version;
    const trackViewUrl = result.trackViewUrl;
    if (version !== RNAppUpdate.versionName) {
      if (this.options.needUpdateApp) {
        this.options.needUpdateApp((isUpdate) => {
          if (isUpdate) {
            RNAppUpdate.installFromAppStore(trackViewUrl);
          }
        });
      }
    }
  }

  getVersionError(err) {
    console.log("getVersionError", err);
  }

  downloadApkError(err) {
    console.log("downloadApkError", err);
    this.options.onError && this.options.onError();
  }

  checkUpdate() {
    if (Platform.OS === 'android') {
      this.getApkVersion();
    } else {
      this.getAppStoreVersion();
    }
  }
}

export default AppUpdate;
