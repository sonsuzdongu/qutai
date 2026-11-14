Pod::Spec.new do |s|
  s.name           = 'QutaiEntry'
  s.version        = '1.0.0'
  s.summary        = 'Home Screen quick actions for Qutai'
  s.description    = 'Hands the Home Screen quick action the user picked to JavaScript (src/device/entryPoints.ts).'
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

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
