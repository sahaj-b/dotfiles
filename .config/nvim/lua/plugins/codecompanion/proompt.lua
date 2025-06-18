local prompt_path = vim.fn.expand("~/notes/.prompt.md")
local prompt_content = ""

local file, err = io.open(prompt_path, "r")
if not file then
  vim.notify(
    "Couldn't open CodeCompanion prompt file: " .. prompt_path .. " - Error: " .. (err or "unknown error"),
    vim.log.levels.ERROR)
  -- prompt_content = ""
  return prompt_content
end

local content, read_err = file:read("*a")
file:close()
if not content then
  vim.notify(
    "Couldn't read CodeCompanion prompt file: " .. prompt_path .. " - Error: " .. (read_err or "unknown error"),
    vim.log.levels.ERROR)
  -- prompt_content = ""
  return prompt_content
end

prompt_content = content
return prompt_content
