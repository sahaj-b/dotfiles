local function getEnvVars()
  local dotenv = require("rest-nvim.parser.dotenv")
  local env_file = vim.b._rest_nvim_env_file
  local envVars = {}
  if env_file then
    local ok, vars = dotenv.parse(env_file)
    if ok then
      envVars = vars
    else
      vim.schedule(function()
        vim.notify("Failed to load environment file: " .. env_file, vim.log.levels.WARN)
      end)
    end
  end
  return envVars
end

local function applySubstitutions(lines, useEnvVars)
  if useEnvVars then
    local env = getEnvVars()
    if env then
      for i, line in ipairs(lines) do
        for k, v in pairs(env) do
          line = line:gsub("{{" .. k .. "}}", v)
        end
        lines[i] = line
      end
    end
  else
    for i, line in ipairs(lines) do
      -- escape brackets so the request parser doesn't remove them
      line = line:gsub("{{", "\\{\\{"):gsub("}}", "\\}\\}")
      lines[i] = line
    end
  end
  return lines
end

local function extractCurlCommands(useEnvVars, format)
  local parser = require("rest-nvim.parser")
  local builder = require("rest-nvim.client.curl.cli").builder

  local originalBuf = vim.api.nvim_get_current_buf()
  local originalLines = vim.api.nvim_buf_get_lines(originalBuf, 0, -1, false)

  vim.cmd("vnew")
  local scratchBuf = vim.api.nvim_get_current_buf()

  local modifiedLines = applySubstitutions(originalLines, useEnvVars)
  vim.api.nvim_buf_set_lines(scratchBuf, 0, -1, false, modifiedLines)

  local nodes = parser.get_all_request_nodes()
  print("Extracting " .. #nodes .. " requests to curl commands")
  local output = {}

  for _, node in ipairs(nodes) do
    local request = parser.parse(node, 0)
    request.cookies = {}

    if request.body and request.body.__TYPE == "json" and (not request.headers or not request.headers["content-type"]) then
      request.headers = request.headers or {}
      request.headers["content-type"] = { "application/json" }
    end

    table.insert(output, "# " .. request.name)
    local curlCmd = builder.build_command(request)
    curlCmd = curlCmd:gsub("%-sL", "-L")
    if not useEnvVars then
      -- revert the escaping for the final output.
      curlCmd = curlCmd:gsub("\\{\\{", "{{"):gsub("\\}\\}", "}}")
    end

    if format then
      for _, line in ipairs(vim.split(curlCmd, "\n", true)) do
        table.insert(output, line)
      end
    else
      curlCmd = curlCmd:gsub("\n", " ")
      table.insert(output, curlCmd)
    end
    table.insert(output, "")
  end

  -- replace scratchpad content with the curl commands
  vim.api.nvim_buf_set_lines(scratchBuf, 0, -1, false, output)
  vim.bo.filetype = "sh"
end

vim.api.nvim_create_user_command("ExtractCommands", function(opts)
  local unformatted = (opts.args == "compact")
  extractCurlCommands(true, not unformatted)
end, { nargs = "?" })

vim.api.nvim_create_user_command("ExtractCommandsVar", function(opts)
  local unformatted = (opts.args == "compact")
  extractCurlCommands(false, not unformatted)
end, { nargs = "?" })

local function substituteEnvVars2(revert)
  local env = getEnvVars()

  if not env then
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
