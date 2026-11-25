Pod::Spec.new do |s|
  s.name           = 'QutaiDownloads'
  s.version        = '1.0.0'
  s.summary        = 'Opening and saving downloaded files on iOS, iPad and Mac'
  s.description    = 'Quick Look preview, the Mac default app and the system export picker for finished downloads (src/storage/iosDownloads.ts).'
  s.license        = 'Apache-2.0'
  s.author         = 'Qutai'
  s.homepage       = 'https://github.com/sonsuzdongu/qutai'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/sonsuzdongu/qutai.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'QuickLook', 'UniformTypeIdentifiers'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
