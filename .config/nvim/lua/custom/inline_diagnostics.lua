---@class CodeCompanion.Inline.EditorContext.Diagnostics: CodeCompanion.Inline.EditorContextItems
local Diagnostics = {}

---@param args CodeCompanion.Inline.EditorContextArgs
function Diagnostics.new(args)
  return setmetatable({
    context = args.context,
  }, { __index = Diagnostics })
end

---Fetch LSP diagnostics for the current buffer and return as a formatted string
---@return string|nil
function Diagnostics:output()
  local bufnr = self.context.bufnr
  if not bufnr then
    return nil
  end

  local severity_labels = {
    [vim.diagnostic.severity.ERROR] = "ERROR",
    [vim.diagnostic.severity.WARN] = "WARNING",
    [vim.diagnostic.severity.INFO] = "INFORMATION",
    [vim.diagnostic.severity.HINT] = "HINT",
  }

  local diagnostics = vim.diagnostic.get(bufnr, {
    severity = { min = vim.diagnostic.severity.HINT },
  })

  if #diagnostics == 0 then
    return nil
  end

  local buf_lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, true)

  local formatted = {}
  for _, diagnostic in ipairs(diagnostics) do
    local lines_snippet = {}
    for line = diagnostic.lnum, diagnostic.end_lnum do
      if line >= 0 and line < #buf_lines then
        table.insert(
          lines_snippet,
          string.format("  %d: %s", line + 1, vim.trim(buf_lines[line + 1]))
        )
      end
    end

    table.insert(
      formatted,
      string.format(
        [[Severity: %s
LSP Message: %s
Line: %d
Code:
```
%s
```]],
        severity_labels[diagnostic.severity] or "UNKNOWN",
        diagnostic.message,
        diagnostic.lnum + 1,
        table.concat(lines_snippet, "\n")
      )
    )
  end

  return string.format(
    [[To help you assist with my user prompt, here are the LSP diagnostics in the current buffer:

%s]],
    table.concat(formatted, "\n\n")
  )
end

return Diagnostics
