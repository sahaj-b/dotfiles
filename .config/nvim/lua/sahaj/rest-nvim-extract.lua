local function getEnvVars()
  local dotenv = require("rest-nvim.parser.dotenv")
  local env_file = vim.b._rest_nvim_env_file
  local envVars = {}
  if env_file then
    local ok, vars = dotenv.parse(env_file)
    if ok then
      envVars = vars
    else
      vim.notify("Failed to load environment file: " .. env_file, vim.log.levels.WARN)
    end
  end
  return envVars
end

local function substituteEnvVars()
  local env = getEnvVars()
  if not env then
    print("No .env file set from rest.nvim")
    return
  end

  local cmds = {}
  for k, v in pairs(env) do
    table.insert(cmds, "silent! %s/{{" .. k .. "}}/" .. vim.fn.escape(v, "/\\") .. "/g")
  end

  -- execute all substitutions as a single command to allow reverting with undo
  vim.cmd(table.concat(cmds, " | "))
end

local function extract_curl_commands(useEnvVars, formatted)
  local parser = require("rest-nvim.parser")
  local builder = require("rest-nvim.client.curl.cli").builder

  if useEnvVars then
    substituteEnvVars()
  else
    -- replace '{{' and '}}' with '\{\{' and '\}\}' across whole file
    -- to prevent parser from removing variables
    vim.cmd([[
    silent! %s/{{/\\{\\{/g
    silent! %s/}}/\\}\\}/g
    silent! nohl
    ]])
  end

  local nodes = parser.get_all_request_nodes()
  print("Extracting " .. #nodes .. " curl commands")
  local output = {}

  for _, node in ipairs(nodes) do
    local request = parser.parse(node, 0)

    request.cookies = {}

    if request.body and request.body.__TYPE == "json" and (not request.headers or not request.headers["content-type"]) then
      -- adding content-type header if body is json
      request.headers = request.headers or {}
      request.headers["content-type"] = { "application/json" }
    end

    table.insert(output, "# " .. request.name)
    local curl_cmd = builder.build_command(request)
    curl_cmd = curl_cmd:gsub("%-sL", "-L")
    -- curl_cmd = curl_cmd:gsub("%-%-data%-raw", "-d")

    if not useEnvVars then
      -- replace \{\{ and \}\} with {{ and }} in the output command
      curl_cmd = curl_cmd:gsub("\\{\\{", "{{"):gsub("\\}\\}", "}}")
    end

    if formatted then
      for _, line in ipairs(vim.split(curl_cmd, "\n", true)) do
        table.insert(output, line)
      end
    else
      curl_cmd = curl_cmd:gsub("\n", " ")
      table.insert(output, curl_cmd)
    end
    table.insert(output, "")
  end

  -- revert variable changes
  vim.cmd("silent undo")

  vim.cmd("vnew")
  vim.api.nvim_buf_set_lines(0, 0, -1, false, output)
  vim.bo.filetype = "sh"
end

vim.api.nvim_create_user_command("ExtractCommands", function(opts)
  local unformatted = (opts.args == "compact")
  extract_curl_commands(false, not unformatted)
end, { nargs = "?" })

vim.api.nvim_create_user_command("ExtractCommandsEnv", function(opts)
  local unformatted = (opts.args == "compact")
  extract_curl_commands(true, not unformatted)
end, { nargs = "?" })

local function substituteEnvVars2(revert)
  local env = getEnvVars()

  if not env then
    print("No .env file set from rest.nvim")
    return
  end

  local bufnr = vim.api.nvim_get_current_buf()
  local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)

  for i, line in ipairs(lines) do
    if revert then
      local keys = {}
      for k, _ in pairs(env) do table.insert(keys, k) end
      -- give higher priority to longer key values
      table.sort(keys, function(a, b) return #env[a] > #env[b] end)
      for _, k in ipairs(keys) do
        local v = env[k]
        line = line:gsub(v, "{{" .. k .. "}}")
      end
    else
      for k, v in pairs(env) do
        line = line:gsub("{{" .. k .. "}}", v)
      end
    end
    lines[i] = line
  end

  vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
end
vim.api.nvim_create_user_command("EnvReplace", function() substituteEnvVars2(false) end, {})
vim.api.nvim_create_user_command("EnvRevert", function() substituteEnvVars2(true) end, {})
