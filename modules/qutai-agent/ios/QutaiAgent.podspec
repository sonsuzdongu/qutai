Pod::Spec.new do |s|
  s.name           = 'QutaiAgent'
  s.version        = '1.0.0'
  s.summary        = 'Lets an AI request finish after Qutai leaves the screen'
  s.description    = 'Asks iOS for background time while an own-key AI request is in flight (src/device/requestHold.ts).'
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
