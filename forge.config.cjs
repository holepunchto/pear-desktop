const pkg = require('./package.json')
const appName = pkg.productName ?? pkg.name

let packagerConfig = {
  icon: 'Icon',
  protocols: [{ name: appName, schemes: [pkg.name] }]
}

const macNotaryProfile = process.env.MAC_NOTARY_PROFILE || process.env.MAC_NOTARY_KEYCHAIN_PROFILE
const macNotaryKeychain = process.env.MAC_NOTARY_KEYCHAIN
const osxNotarize = macNotaryProfile
  ? {
      keychainProfile: macNotaryProfile,
      ...(macNotaryKeychain ? { keychain: macNotaryKeychain } : {})
    }
  : {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.TEAM_ID
    }

if (process.env.MAC_CODESIGN_IDENTITY) {
  packagerConfig = {
    ...packagerConfig,
    osxSign: {
      identity: process.env.MAC_CODESIGN_IDENTITY
    },
    osxNotarize
  }
}

module.exports = {
  packagerConfig,

  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@forkprince/electron-forge-maker-appimage',
      platforms: ['linux'],
      config: {
        icons: [{ file: 'Icon.png', size: 1024 }]
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    }
  ],

  plugins: [
    {
      name: 'electron-forge-plugin-universal-prebuilds',
      config: {}
    },
    {
      name: 'electron-forge-plugin-prune-prebuilds',
      config: {}
    }
  ]
}
