package main

// you can add your browser on line 101 in the playerctl command

// Note for chromium-based browsers(chrome, brave, vivaldi, etc):
// The xesam:url property isn't available, so it won't work, so change the checkUrl variable to false on line 48

// Toggle visualizer on/off:
// Send SIGUSR1 signal to toggle: pkill -SIGUSR1 caway
// When off, shows song name without visualizer bars (class: NoVisualizer)
// When on, shows visualizer bars when music is playing (You gotta manually play->pause once to see cava after toggling on)

import (
	"bufio"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"html"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type WaybarOutput struct {
	Text    string `json:"text"`
	Tooltip string `json:"tooltip"`
	Alt     string `json:"alt"`
	Class   string `json:"class"`
	URL     string `json:"url,omitempty"`
}

type Config struct {
	Bars      int
	Framerate int
	Equilizer bool
	Debug     bool
}

var (
	bars            = []rune("▁▂▃▄▅▆▇█")
	checkUrl        = false // change this to false for chromium-based browsers
	validURLPattern = regexp.MustCompile(`(spotify|music\.youtube)`)
)

func main() {
	config := parseFlags()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	setupSignalHandler(cancel)

	if err := run(ctx, config); err != nil {
		log.Fatal(err)
	}
}

func parseFlags() *Config {
	config := &Config{}

	flag.IntVar(&config.Bars, "b", 8, "Number of bars to display")
	flag.IntVar(&config.Framerate, "f", 60, "Framerate of the equalizer")
	flag.BoolVar(&config.Equilizer, "e", true, "Enable equalizer (use -e=false to disable)")
	flag.BoolVar(&config.Debug, "d", false, "Enable debug output")
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "caway usage: caway [options...]\n")
		fmt.Fprintf(os.Stderr, "where options include:\n\n")
		flag.PrintDefaults()
	}
	flag.Parse()

	return config
}

var (
	cavaCancelGlobal  context.CancelFunc
	cavaStoppedGlobal bool
	lastOutputGlobal  WaybarOutput
)

func setupSignalHandler(cancel context.CancelFunc) {
	c := make(chan os.Signal, 1)
	usr1 := make(chan os.Signal, 1)

	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	signal.Notify(usr1, syscall.SIGUSR1)

	go func() {
		for {
			select {
			case <-c:
				cancel()
				return
			case <-usr1:
				toggleCava()
			}
		}
	}()
}

func toggleCava() {
	cavaStoppedGlobal = !cavaStoppedGlobal

	if cavaStoppedGlobal {
		exec.Command("pkill", "-f", "cava.*cava_waybar_config").Run()

		if cavaCancelGlobal != nil {
			cavaCancelGlobal()
			cavaCancelGlobal = nil
		}

		if lastOutputGlobal.Text != "" {
			lastOutputGlobal.Class = "NoVisualizer"
			outputJSON, _ := json.Marshal(lastOutputGlobal)
			fmt.Println(string(outputJSON))
		}
	}
}

func debugLog(config *Config, format string, args ...any) {
	if config.Debug {
		fmt.Fprintf(os.Stderr, "DEBUG: "+format+"\n", args...)
	}
}

func run(ctx context.Context, config *Config) error {
	debugLog(config, "Killing existing processes...")
	exec.Command("pkill", "-f", "cava.*cava_waybar_config").Run()
	exec.Command("pkill", "-f", "playerctl.*-F").Run()

	debugLog(config, "Starting caway with %d bars, %d fps, equalizer=%t", config.Bars, config.Framerate, config.Equilizer)

	cmd := exec.CommandContext(ctx, "playerctl",
		"-p", "chromium,spotify",
		"metadata",
		"--format", `{"text": "{{markup_escape(title)}}", "tooltip": "{{playerName}} : {{markup_escape(title)}} - {{markup_escape(artist)}}", "alt": "{{status}}", "class": "{{status}}", "url": "{{xesam:url}}"}`,
		"-F")

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start playerctl: %w", err)
	}

	go func() {
		<-ctx.Done()
		cmd.Process.Kill()
	}()

	debugLog(config, "Starting main loop, reading from playerctl...")

	scanner := bufio.NewScanner(stdout)
	var cavaCancel context.CancelFunc

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		debugLog(config, "Raw line: %s", line)

		if line == "" || strings.Contains(line, "null") {
			debugLog(config, "Skipping empty/null line")
			continue
		}

		var output WaybarOutput
		if err := json.Unmarshal([]byte(line), &output); err != nil {
			debugLog(config, "Failed to parse JSON: %v", err)
			continue
		}

		if checkUrl && !validURLPattern.MatchString(output.URL) {
			debugLog(config, "Skipping non-spotify/youtube music URL: %s", output.URL)
			continue
		}

		debugLog(config, "Valid JSON received, processing...")

		if cavaCancel != nil {
			debugLog(config, "Canceling previous cava context")
			cavaCancel()
			cavaCancel = nil
		}

		output.Text = html.UnescapeString(output.Text)
		output.Tooltip = html.UnescapeString(output.Tooltip)

		if cavaStoppedGlobal && output.Class == "Playing" {
			output.Class = "NoVisualizer"
		}

		lastOutputGlobal = output

		outputJSON, _ := json.Marshal(output)
		debugLog(config, "Cleaned line: %s", string(outputJSON))
		fmt.Println(string(outputJSON))

		debugLog(config, "Player status: %s, equalizer: %t", output.Class, config.Equilizer)

		if config.Equilizer && output.Class == "Playing" && !cavaStoppedGlobal {
			debugLog(config, "Starting equalizer mode...")

			var cavaCtx context.Context
			cavaCtx, cavaCancel = context.WithCancel(ctx)
			cavaCancelGlobal = cavaCancel
			go func() {
				debugLog(config, "Goroutine started, beginning sleep...")
				time.Sleep(2 * time.Second)
				debugLog(config, "Sleep finished, calling runCavaVisualizer")
				runCavaVisualizer(cavaCtx, config, output)
				debugLog(config, "runCavaVisualizer returned")
			}()
		}
	}

	if cavaCancel != nil {
		cavaCancel()
	}

	return scanner.Err()
}

func runCavaVisualizer(ctx context.Context, config *Config, baseOutput WaybarOutput) {
	debugLog(config, "Starting cava process...")

	configFile := "/tmp/cava_waybar_config_go"
	cavaConfig := fmt.Sprintf(`[general]
mode = normal
framerate = %d
bars = %d

[output]
method = raw
data_format = ascii
ascii_max_range = 7
channels = mono
`, config.Framerate, config.Bars)

	debugLog(config, "Writing cava config to %s", configFile)
	if err := os.WriteFile(configFile, []byte(cavaConfig), 0o644); err != nil {
		debugLog(config, "Failed to write cava config: %v", err)
		return
	}
	debugLog(config, "Cava config written successfully")

	defer func() {
		debugLog(config, "Cleaning up config file")
		os.Remove(configFile)
	}()

	debugLog(config, "Creating cava command: cava -p %s", configFile)
	cmd := exec.CommandContext(ctx, "cava", "-p", configFile)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		debugLog(config, "Failed to create cava stdout pipe: %v", err)
		return
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		debugLog(config, "Failed to create cava stderr pipe: %v", err)
		return
	}

	debugLog(config, "Starting cava command...")
	if err := cmd.Start(); err != nil {
		debugLog(config, "Failed to start cava: %v", err)
		return
	}
	debugLog(config, "Cava started with PID: %d", cmd.Process.Pid)

	// Monitor stderr for cava errors
	go func() {
		stderrScanner := bufio.NewScanner(stderr)
		for stderrScanner.Scan() {
			debugLog(config, "CAVA STDERR: %s", stderrScanner.Text())
		}
	}()

	go func() {
		<-ctx.Done()
		debugLog(config, "Context cancelled, killing cava process")
		cmd.Process.Kill()
	}()

	debugLog(config, "Starting to read cava output...")
	scanner := bufio.NewScanner(stdout)
	lineCount := 0
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			debugLog(config, "Context cancelled during scan")
			return
		default:
		}

		lineCount++
		line := strings.TrimSpace(scanner.Text())
		debugLog(config, "Cava output line %d: '%s'", lineCount, line)

		if line == "" {
			debugLog(config, "Skipping empty cava output")
			continue
		}

		visualOutput := baseOutput
		visualOutput.Text = convertCavaToBars(line)
		debugLog(config, "Converted to bars: '%s'", visualOutput.Text)

		outputJSON, _ := json.Marshal(visualOutput)
		fmt.Println(string(outputJSON))
	}

	if err := scanner.Err(); err != nil {
		debugLog(config, "Cava scanner error: %v", err)
	}

	debugLog(config, "Cava visualization ended, total lines read: %d", lineCount)

	// Wait for process to finish and check exit status
	if err := cmd.Wait(); err != nil {
		debugLog(config, "Cava process exited with error: %v", err)
	} else {
		debugLog(config, "Cava process exited normally")
	}
}

func convertCavaToBars(cavaOutput string) string {
	var result strings.Builder

	for _, char := range cavaOutput {
		if char >= '0' && char <= '7' {
			index, _ := strconv.Atoi(string(char))
			if index < len(bars) {
				result.WriteRune(bars[index])
				result.WriteRune('\u2009')
			}
		}
	}

	output := result.String()
	if len(output) > 0 {
		// Remove last thin space properly (Unicode-aware)
		runes := []rune(output)
		if len(runes) > 0 {
			output = string(runes[:len(runes)-1])
		}
	}

	return output
}
