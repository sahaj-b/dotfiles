-- Overcomplicated Asynchrounous and cached folding text with treesitter syntax highlighting, but it works
-- Global cache table: for each buffer, cache results per fold start line.
local foldtext_cache = {}

-- A helper function that does the heavy work.
local function compute_foldtext(bufnr, pos)
  local line = vim.api.nvim_buf_get_lines(bufnr, pos - 1, pos, false)[1]
  local ft = vim.bo.filetype
  local lang = vim.treesitter.language.get_lang(ft)
  if not lang then
    return vim.fn.foldtext() -- fallback: returns a plain string
  end

  local parser = vim.treesitter.get_parser(bufnr, lang)
  local query = vim.treesitter.query.get(parser:lang(), "highlights")
  if not query then
    return vim.fn.foldtext()
  end

  local tree = parser:parse({ pos - 1, pos })[1]
  local result_parts = {}
  local line_pos = 0
  local prev_range = nil

  for id, node, _ in query:iter_captures(tree:root(), bufnr, pos - 1, pos) do
    local name = query.captures[id]
    local start_row, start_col, end_row, end_col = node:range()
    if start_row == pos - 1 and end_row == pos - 1 then
      local range = { start_col, end_col }
      if start_col > line_pos then
        table.insert(result_parts, { line:sub(line_pos + 1, start_col), "Folded" })
      end
      line_pos = end_col
      local text = vim.treesitter.get_node_text(node, bufnr)
      if prev_range and range[1] == prev_range[1] and range[2] == prev_range[2] then
        result_parts[#result_parts] = { text, "@" .. name }
      else
        table.insert(result_parts, { text, "@" .. name })
      end
      prev_range = range
    end
  end

  -- local fold_lines = vim.v.foldend - pos + 1
  -- table.insert(result_parts, { " 󰁂 " .. fold_lines .. " ", "FoldIcon" })
  table.insert(result_parts, { " ⋯ ", "FoldIcon" })
  -- Return the list of chunks to preserve per-chunk highlights.
  return result_parts
end

-- Async updater: when called, schedules a background computation.
local function update_foldtext_async(bufnr, pos)
  local timer = vim.loop.new_timer()
  timer:start(0, 0, function()
    -- Schedule the computation to run on the main thread
    vim.schedule(function()
      local text = compute_foldtext(bufnr, pos)
      foldtext_cache[bufnr] = foldtext_cache[bufnr] or {}
      foldtext_cache[bufnr][pos] = text
      vim.cmd("redraw")
    end)
    timer:stop()
    timer:close()
  end)
end

-- Our foldtext callback: it returns cached text if available; otherwise, kick off an async update.
function foldtext()
  local pos = vim.v.foldstart
  local bufnr = vim.api.nvim_get_current_buf()
  foldtext_cache[bufnr] = foldtext_cache[bufnr] or {}
  if foldtext_cache[bufnr][pos] then
    return foldtext_cache[bufnr][pos]
  else
    -- Start async computation if not already in progress.
    update_foldtext_async(bufnr, pos)
    -- Return a temporary placeholder.
    return vim.fn.foldtext()
  end
end

-- This one is simple, but slows down nvim
-- function foldtext()
--   local pos = vim.v.foldstart
--   local line = vim.api.nvim_buf_get_lines(0, pos - 1, pos, false)[1]
--   local lang = vim.treesitter.language.get_lang(vim.bo.filetype)
--   local parser = vim.treesitter.get_parser(0, lang)
--   local query = vim.treesitter.query.get(parser:lang(), "highlights")
--
--   if query == nil then
--     return vim.fn.foldtext()
--   end
--
--   local tree = parser:parse({ pos - 1, pos })[1]
--   local result = {}
--
--   local line_pos = 0
--
--   local prev_range = nil
--
--   for id, node, _ in query:iter_captures(tree:root(), 0, pos - 1, pos) do
--     local name = query.captures[id]
--     local start_row, start_col, end_row, end_col = node:range()
--     if start_row == pos - 1 and end_row == pos - 1 then
--       local range = { start_col, end_col }
--       if start_col > line_pos then
--         table.insert(result, { line:sub(line_pos + 1, start_col), "Folded" })
--       end
--       line_pos = end_col
--       local text = vim.treesitter.get_node_text(node, 0)
--       if prev_range ~= nil and range[1] == prev_range[1] and range[2] == prev_range[2] then
--         result[#result] = { text, "@" .. name }
--       else
--         table.insert(result, { text, "@" .. name })
--       end
--       prev_range = range
--     end
--   end
--   local fold_lines = vim.v.foldend - pos + 1
--   table.insert(result, { " 󰁂 " .. fold_lines .. " ", "FoldIcon" })
--   return result
-- end

vim.opt.foldtext = "v:lua.foldtext()"
