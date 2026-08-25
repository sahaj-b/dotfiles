# TLP vs auto-cpufreq: Reddit & Community Discussion Research

## Executive Summary

Research compiled from Reddit, Lemmy, Framework Community forums, Manjaro forums, Zorin forums, EndeavourOS forums, and GitHub discussions reveals a nuanced landscape where neither tool is universally "better" — the choice depends on hardware, use case, and desired control level.

---

## 1. Tool Overview

### TLP (linrunner/TLP)
- **GitHub Stars:** ~3,300
- **Language:** Shell (89.4%), Python (6.9%)
- **Approach:** Feature-rich, highly configurable power management daemon
- **Scope:** CPU, GPU, USB, PCIe, radio devices, disk, audio, battery thresholds
- **Philosophy:** "Set it and forget it" with extensive customization

### auto-cpufreq (AdnanHodzic/auto-cpufreq)
- **GitHub Stars:** ~7,700
- **Language:** Python (80.2%), Shell (14%)
- **Approach:** Automatic CPU frequency scaling based on load/power state
- **Scope:** Primarily CPU governor, turbo boost, scaling frequencies
- **Philosophy:** Dynamic, automatic optimization with minimal configuration

---

## 2. User Preferences & Experiences

### Preference for auto-cpufreq

**Framework Community user (AMD 7040U):**
> "I tried a couple things with the AMD framework laptop 13 (TLP, PPD+gnome integration, autocpufreq), and if you're looking for the best seamless integration and the most fluid on-battery performance while maximizing battery time, then go with autocpufreq and don't touch the initial config. TLP is too complicated to configure to a point where the performance is not sloppy on battery, and usually more aimed toward Intel stack."

**Source:** https://community.frame.work/t/responded-best-tool-to-optimize-battery-life/41438

**Zorin Forum user:**
> "I noticed that battery life on linux in laptops sucks compared to windows... But there is a software that implements the thing in linux. I have seen significant battery life improvements after installing it. The software is auto-cpufreq."

**Source:** https://forum.zorin.com/t/improve-battery-life-on-linux-better-than-tlp/11780

### Preference for TLP

**Lemmy user (Veraxis):**
> "I prefer tlp, as it gives me more granular control than autocpu-freq, which I have also used. It allows me to retain control over certain things like USB auto-suspend behavior, and the audio powerdown on the headphone jack when on battery."

**Source:** https://old.feddit.dk/post/20445119

**Framework Community user (nadb):**
> "In my years of playing with and working with linux I have found that TLP with Thermald gives me the performance, and battery life profile I want in a laptop. This happens with minimal manual intervention on my part and once set it is on auto-pilot, I don't need to play around, I don't need to manually select profiles."

**Source:** https://community.frame.work/t/tracking-linux-battery-life-tuning/6665?page=21

**Manjaro Forum user:**
> "TLP is used to enable a whole plethora power-saving settings. Most of the power-saving options are already enabled, but you can still customize it through it's configuration file."

**Source:** https://forum.manjaro.org/t/is-auto-cpufreq-alone-good-enough/101093

### Combined Use (TLP + auto-cpufreq)

**Framework Community user (Mistral24):**
> "I have **the best results with TLP and auto-cpufreq in combination**. After two days of heavy using my Framework with that setting I experienced no major issues so far. The only thing is a weird behavior after suspend that shows up occasionally. The cpu then tends to throttle under load. A reboot resolves that."

**Source:** https://community.frame.work/t/tracking-linux-battery-life-tuning/6665?page=21

**GitHub Discussion user (peterdieleman):**
> Shared config showing TLP handling PCIe, radio, devices while auto-cpufreq handles CPU governor and turbo settings.

**Source:** https://github.com/AdnanHodzic/auto-cpufreq/discussions/176

---

## 3. Common Complaints

### TLP Complaints

| Issue | Source |
|-------|--------|
| **Bluetooth problems:** "TLP is causing Bluetooth issue. Bluetooth turns on automatically with tlp enabled." | https://forum.manjaro.org/t/is-auto-cpufreq-alone-good-enough/101093 |
| **USB device issues:** "Bluetooth and usb not working with tlp on battery" | https://forum.manjaro.org/t/bluetooth-and-usb-not-working-with-tlp-on-battery/96833 |
| **Complexity:** "TLP is too complicated to configure to a point where the performance is not sloppy on battery" | https://community.frame.work/t/responded-best-tool-to-optimize-battery-life/41438 |
| **Intel-centric:** Often perceived as more optimized for Intel hardware | Multiple forum discussions |
| **Dropped from distros:** "TLP has been dropped from official [Manjaro] isos" | https://forum.manjaro.org/t/is-auto-cpufreq-alone-good-enough/101093 |

### auto-cpufreq Complaints

| Issue | Source |
|-------|--------|
| **Battery drain increase:** User reported "less battery life when auto-cpufreq is enabled" - acpi showed 1:12 remaining off vs 0:37 remaining on | https://github.com/AdnanHodzic/auto-cpufreq/discussions/710 |
| **Governor stuck on powersave:** "auto-cpufreq --monitor says the current governor and suggested governor is 'powersave' all the time" even under load | https://github.com/AdnanHodzic/auto-cpufreq/discussions/272 |
| **Fedora/Gnome lockups:** "I'm getting frequent lockups when running on Fedora 40" | https://github.com/AdnanHodzic/auto-cpufreq/issues/685 |
| **Kernel panics:** "Kernel Panic when starting auto-cpufreq & changing governor with Ubuntu's 6.17 HWE kernel" | https://github.com/AdnanHodzic/auto-cpufreq/issues/940 |
| **Limited scope:** "auto-cpufreq only changes the CPU governor... you need to disable the intel_pstate driver to see real gains" | https://old.feddit.dk/post/20445119 |
| **TLP warnings:** Displays warning about TLP being enabled, causing user confusion | https://forum.zorin.com/t/improve-battery-life-on-linux-better-than-tlp/11780 |

---

## 4. Benchmarks & Power Consumption Numbers

### Framework Community Detailed Testing (AMD 7040U)

**Source:** https://community.frame.work/t/tracking-linux-battery-life-tuning/6665?page=21

| Configuration | Idle | Browsing | LibreOffice | YouTube 1080p |
|--------------|------|----------|-------------|---------------|
| Just Kernel | 6-7W | 10-12W | 8-10W | 16-20W |
| PPD (power saver) | Worse than kernel | - | - | - |
| auto-cpufreq alone | 5-6W | 8-11W | 7-9W | 14-18W |
| **TLP + auto-cpufreq** | **4-5W** | **5-8W** | **5-8W** | **11-15W** |

**Key finding:** TLP + auto-cpufreq combination achieved **30-40% power reduction** compared to PPD.

### Additional Testing (AMD 7640U, Fedora 39)

| Configuration | Idle | Browsing | LibreOffice | YouTube |
|--------------|------|----------|-------------|---------|
| PPD | 4-5W | 8-11W | 6-8W | 15-17W |
| TLP | 4.3W | 6.5-8W | 4.9-5.7W | 11.6-12.7W |

**Source:** https://community.frame.work/t/tracking-linux-battery-life-tuning/6665?page=21

### Intel 12th Gen Results

**User nadb reported:**
- Regularly sitting under 5W for daily usage
- Video playback: 7.5-8W software decode, 6-6.5W hardware decode
- Idle: 3.7-4W with TLP

**Source:** https://community.frame.work/t/tracking-linux-battery-life-tuning/6665?page=21

### Negative Results

**User jfab20 reported (ASUS TUF Gaming):**
- Without auto-cpufreq: 1:12 remaining at 24%
- With auto-cpufreq: 0:37 remaining at 24%
- "I think it is interesting to note that tlp has the same effect"

**Source:** https://github.com/AdnanHodzic/auto-cpufreq/discussions/710

---

## 5. Technical Differences

### TLP Advantages
- ✅ Manages USB auto-suspend
- ✅ PCIe ASPM control (major power saver)
- ✅ Radio device management (WiFi, Bluetooth, WWAN)
- ✅ Battery charge thresholds
- ✅ Disk power management
- ✅ Audio power management
- ✅ GPU power management (Radeon DPM)
- ✅ Multiple configuration profiles possible

### auto-cpufreq Advantages
- ✅ Automatic, dynamic CPU governor switching
- ✅ Turbo boost management
- ✅ Real-time monitoring (`--monitor`, `--stats`)
- ✅ Simpler initial setup
- ✅ Better default behavior for most hardware
- ✅ GUI available (v3.1+)
- ✅ Works well without configuration

### Critical Setting: PCIe ASPM

**Framework Community user noted:**
> "One setting in TLP that reduces the power consumption above all was the *powersupersave* of pcie (ASPM)."

This is a TLP-specific feature that auto-cpufreq does not provide.

---

## 6. Community Recommendations by Hardware

### AMD Ryzen 7040U/7080U
- **Recommendation:** TLP + auto-cpufreq combination
- **Note:** Must disable `amd_pstate` in kernel boot options for best results
- **Source:** https://community.frame.work/t/responded-best-tool-to-optimize-battery-life/41438

### Intel 12th/13th Gen
- **Recommendation:** TLP alone sufficient
- **Key setting:** Disable turbo on battery
- **Source:** https://community.frame.work/t/tracking-linux-battery-life-tuning/6665?page=21

### Intel 11th Gen
- **Recommendation:** PPD or TLP both work well
- **Source:** https://community.frame.work/t/tracking-linux-battery-life-tuning/6665?page=21

---

## 7. Configuration Tips for Combined Use

### TLP Config (Comment Out CPU Settings)

```ini
# Comment out all CPU-related settings in /etc/tlp.conf
#CPU_SCALING_GOVERNOR_ON_AC
#CPU_SCALING_GOVERNOR_ON_BAT
#CPU_SCALING_MIN_FREQ_ON_AC
#CPU_SCALING_MIN_FREQ_ON_BAT
#CPU_SCALING_MAX_FREQ_ON_AC
#CPU_SCALING_MAX_FREQ_ON_BAT
#CPU_HWP_ON_AC
#CPU_HWP_ON_BAT
#CPU_BOOST_ON_AC
#CPU_BOOST_ON_BAT

# Keep these TLP settings active:
TLP_ENABLE=1
RUNTIME_PM_ON_BAT=auto
PCIE_ASPM_ON_BAT=powersupersave
DEVICES_TO_DISABLE_ON_BAT_NOT_IN_USE="bluetooth"
```

### auto-cpufreq Config (/etc/auto-cpufreq.conf)

```ini
[charger]
governor = performance
turbo = auto

[battery]
governor = powersave
turbo = never
```

**Source:** https://github.com/AdnanHodzic/auto-cpufreq/discussions/176

---

## 8. Source Links

### Reddit/Lemmy Discussions
1. https://old.feddit.dk/post/20445119 (Lemmy: power-profiles-daemon vs auto-cpufreq vs tlp)
2. https://lemmy.eus/post/1845473 (Lemmy mirror)
3. https://piefed.zip/post/5880 (Lemmy: battery life suggestions)

### Framework Community Forums
4. https://community.frame.work/t/responded-best-tool-to-optimize-battery-life/41438
5. https://community.frame.work/t/tracking-linux-battery-life-tuning/6665?page=21

### Linux Distribution Forums
6. https://forum.manjaro.org/t/is-auto-cpufreq-alone-good-enough/101093
7. https://forum.manjaro.org/t/bluetooth-and-usb-not-working-with-tlp-on-battery/96833
8. https://forum.zorin.com/t/improve-battery-life-on-linux-better-than-tlp/11780
9. https://forum.endeavouros.com/t/tlp-auto-cpufreq-compatibllity/50431

### Fedora Discussion
10. https://discussion.fedoraproject.org/t/tlp-auto-cpufreq-powertop-what-to-install-to-optimize-my-laptop-battery/180339

### GitHub Discussions
11. https://github.com/AdnanHodzic/auto-cpufreq/discussions/176 (TLP settings recommendation)
12. https://github.com/AdnanHodzic/auto-cpufreq/discussions/280 (Conflicts with powertop/thermald)
13. https://github.com/AdnanHodzic/auto-cpufreq/discussions/272 (Governor stuck on powersave)
14. https://github.com/AdnanHodzic/auto-cpufreq/discussions/710 (Less battery life report)

### Official Documentation
15. https://linrunner.de/tlp/faq/radio.html (TLP Bluetooth troubleshooting)
16. https://wiki.archlinux.org/title/TLP (ArchWiki)

---

## 9. Conclusion

**For most users:** TLP + auto-cpufreq in combination provides the best power savings, with TLP handling peripheral power management (PCIe, USB, radio) and auto-cpufreq handling dynamic CPU scaling.

**For simplicity:** auto-cpufreq alone is easier to set up and provides good results with zero configuration.

**For maximum control:** TLP alone offers the most granular configuration options.

**Avoid:** Running both tools with their CPU settings enabled simultaneously, as they will conflict.
