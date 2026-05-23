--- diagram-tools: extras for diagram.nvim

local M = {}

--- Default "big" render options for external viewing.
--- Scale=3 gives crisp output on high-DPI screens.
local defaults = {
  mermaid  = { scale = 3 },
  d2       = { scale = 3 },
  plantuml = {}, -- no scale option, will just open cached
  gnuplot  = { size = "1920,1080" },
}

--- Let users customise per-renderer big options.
M.big_opts = vim.deepcopy(defaults)

--- Get the source and renderer_id of the diagram under the cursor.
local function diagram_at_cursor()
  local bufnr = vim.api.nvim_get_current_buf()
  local ft = vim.bo[bufnr].filetype
  local row = vim.api.nvim_win_get_cursor(0)[1] - 1

  if ft ~= "markdown" and ft ~= "norg" then return nil end
  local ok, integration = pcall(require, "diagram.integrations." .. ft)
  if not ok then return nil end

  local diagrams = integration.query_buffer_diagrams(bufnr)
  local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)

  for _, d in ipairs(diagrams) do
    local sr, er = d.range.start_row, d.range.end_row
    for i = sr, 0, -1 do
      if (lines[i + 1] or ""):match("^%s*```") then
        sr = i; break
      end
    end
    for i = er, #lines - 1 do
      if (lines[i + 1] or ""):match("^%s*```%s*$") then
        er = i; break
      end
    end
    if row >= sr and row <= er then
      return { renderer_id = d.renderer_id, source = d.source }
    end
  end
  return nil
end

--- Render the diagram at cursor to a high-res temp image and open it.
function M.open_big()
  local diagram = diagram_at_cursor()
  if not diagram then
    vim.notify("No diagram at cursor", vim.log.levels.INFO)
    return
  end

  local id = diagram.renderer_id
  local source = diagram.source
  local opts = M.big_opts[id] or {}

  -- temp source file
  local ext_map = { d2 = ".d2", plantuml = ".pu", gnuplot = ".plt", mermaid = ".mmd" }
  local tmpsrc = vim.fn.tempname() .. (ext_map[id] or ".txt")
  vim.fn.writefile(vim.split(source, "\n"), tmpsrc)

  local tmpout = vim.fn.tempname() .. (id == "d2" and ".svg" or ".png")

  if id == "mermaid" then
    local args = { "mmdc", "-i", tmpsrc, "-o", tmpout }
    if opts.scale then vim.list_extend(args, { "-s", opts.scale }) end
    if opts.width then vim.list_extend(args, { "--width", opts.width }) end
    if opts.height then vim.list_extend(args, { "--height", opts.height }) end
    if opts.background then vim.list_extend(args, { "-b", opts.background }) end
    if opts.theme then vim.list_extend(args, { "-t", opts.theme }) end
    if opts.cli_args then vim.list_extend(args, opts.cli_args) end

    vim.fn.jobstart(table.concat(args, " "), {
      on_exit = function()
        if vim.fn.filereadable(tmpout) == 1 then vim.ui.open(tmpout) end
      end,
    })
  elseif id == "d2" then
    local args = { "d2", tmpsrc, tmpout }
    if opts.scale then vim.list_extend(args, { "--scale", opts.scale }) end
    if opts.layout then vim.list_extend(args, { "--layout", opts.layout }) end
    if opts.sketch then table.insert(args, "-s") end
    if opts.cli_args then vim.list_extend(args, opts.cli_args) end

    vim.fn.jobstart(table.concat(args, " "), {
      on_exit = function()
        if vim.fn.filereadable(tmpout) == 1 then vim.ui.open(tmpout) end
      end,
    })
  elseif id == "plantuml" then
    local args = { "plantuml", "-tpng", "-pipe", "<", tmpsrc, ">", tmpout }
    if opts.charset then vim.list_extend(args, { "-charset", opts.charset }) end
    if opts.cli_args then vim.list_extend(args, opts.cli_args) end

    vim.fn.jobstart(table.concat(args, " "), {
      on_exit = function()
        if vim.fn.filereadable(tmpout) == 1 then vim.ui.open(tmpout) end
      end,
    })
  elseif id == "gnuplot" then
    local script = {}
    table.insert(script, "set terminal pngcairo size " .. (opts.size or "1920,1080"))
    table.insert(script, string.format("set output '%s'", tmpout))
    if opts.theme == "dark" then
      table.insert(script,
        'set object 1 rectangle from screen 0,0 to screen 1,1 behind fillcolor rgb "#000000" fillstyle solid 1.0')
      table.insert(script, 'set border lc rgb "#FFFFFF"')
    end
    table.insert(script, source)

    local scriptpath = vim.fn.tempname() .. ".plt"
    vim.fn.writefile(vim.split(table.concat(script, "\n"), "\n"), scriptpath)

    local args = { "gnuplot" }
    if opts.cli_args then vim.list_extend(args, opts.cli_args) end
    table.insert(args, scriptpath)

    vim.fn.jobstart(table.concat(args, " "), {
      on_exit = function()
        if vim.fn.filereadable(tmpout) == 1 then vim.ui.open(tmpout) end
      end,
    })
  else
    vim.notify("Unsupported renderer: " .. id, vim.log.levels.WARN)
  end
end

return M
