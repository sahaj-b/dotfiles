local shell = os.getenv("SHELL"):match(".*/(.*)")
local get_cwd = ya.sync(function() return tostring(cx.active.current.cwd) end)
local fail = function(s, ...)
  ya.notify { title = "Duck Radar", content = string.format(s, ...), timeout = 5, level = "error" }
end

local function entry()
  ya.dbg("Duck Radar starting")
  local _permit = ya.hide()

  local home = os.getenv("HOME")

  local cmd = "find '" .. home .. "/Downloads' " ..
      "'" .. home .. "/Documents' " ..
      "'" .. home .. "/Desktop' " ..
      "-maxdepth 3 " ..
      "-type f " ..
      "-mtime -7 " ..
      "-not -path '*/.*' " ..
      "-not -path '*/node_modules/*' " ..
      "-not -path '*/.git/*' " ..
      "-not -path '*/cache/*' " ..
      "-not -path '*/Cache/*' " ..
      "-not -path '*/__pycache__/*' " ..
      "-not -path '*/target/*' " ..
      "-not -path '*/build/*' " ..
      "-printf '%T@ %p\\n' 2>/dev/null " ..
      "| sort -rn " ..
      "| head -200 " ..
      "| cut -d' ' -f2- " ..
      "| fzf " ..
      "--prompt='Recent Files> ' " ..
      "--preview='bat --color=always --style=numbers --line-range :100 {} 2>/dev/null || ls -lh {}' " ..
      "--preview-window='right:60%:wrap' " ..
      "--header='Tab=multi • Enter=COPY • Ctrl-X=MOVE • Sorted by modification time' " ..
      "--multi " ..
      "--bind='ctrl-d:preview-down,ctrl-u:preview-up' " ..
      "--bind='enter:execute-silent(echo COPY)+accept' " ..
      "--bind='ctrl-x:execute-silent(echo MOVE)+accept' " ..
      "--expect='enter,ctrl-x'"

  ya.dbg("Running search")

  local child, err = Command(shell)
      :arg("-c")
      :arg(cmd)
      :stdin(Command.INHERIT)
      :stdout(Command.PIPED)
      :stderr(Command.INHERIT)
      :spawn()

  if not child then
    return fail("Command failed: %s", err)
  end

  local output, err = child:wait_with_output()
  if not output then
    return fail("Cannot read output: %s", err)
  end

  ya.dbg("Exit code: " .. tostring(output.status.code))

  if output.status.code == 130 then
    ya.dbg("User cancelled")
    return
  elseif output.status.code == 1 then
    return ya.notify { title = "Duck Radar", content = "No file selected", timeout = 3 }
  elseif output.status.code ~= 0 then
    return fail("fzf exited with code %s", output.status.code)
  end

  local lines = {}
  for line in output.stdout:gmatch("[^\n]+") do
    table.insert(lines, line)
  end

  if #lines == 0 then
    return ya.notify { title = "Duck Radar", content = "No file selected", timeout = 3 }
  end

  local action = "copy"
  local key = lines[1]
  if key == "ctrl-x" then
    action = "move"
  end

  ya.dbg("Action: " .. action)

  local files = {}
  for i = 2, #lines do
    if lines[i] ~= "" and lines[i] ~= "COPY" and lines[i] ~= "MOVE" then
      table.insert(files, lines[i])
    end
  end

  ya.dbg("Selected " .. #files .. " files for " .. action)

  if #files > 0 then
    local cwd = get_cwd()
    ya.dbg("" .. action .. " to: " .. cwd)

    local file_list = {}
    for _, file in ipairs(files) do
      table.insert(file_list, "'" .. file:gsub("'", "'\\''") .. "'")
    end

    local cmd_verb = action == "move" and "mv" or "cp -r"
    local copy_cmd = cmd_verb .. " " .. table.concat(file_list, " ") .. " '" .. cwd .. "/' 2>&1"

    ya.dbg("Command: " .. copy_cmd)

    local result = Command(shell):arg("-c"):arg(copy_cmd):output()

    if result and result.status.success then
      local verb = action == "move" and "Moved" or "Copied"
      ya.notify {
        title = "Duck Radar",
        content = string.format("%s %d file(s)!", verb, #files),
        timeout = 3
      }
    else
      return fail(action .. " failed")
    end
  end
end

return { entry = entry }
