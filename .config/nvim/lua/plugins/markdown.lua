return {
  {
    "OXY2DEV/markview.nvim",
    config = function()
      require("markview").setup({
        experimental = { check_rtp_message = false },
        highlight_groups = {
          -- Customize the highlight group used for bold text
          -- You may need to identify which specific group is used for bold
          -- MarkviewPalette1Fg = { fg = "#ff6b6b", bold = true },
          -- MarkviewInlineCode = {
          --   bg = "#34344B",
          --   fg = "#A6E3A1"
          -- }
        },
        preview = {
          filetypes = { "markdown", "codecompanion", "Avante" },
          -- ignore_buftypes = {},
          --   enable_hybrid_mode = true,
          --   hybrid_modes = { "i" },
          --   ignore_previews = {}
        },
        markdown_inline = {
          checkboxes = {
            checked = { text = "    " },
            unchecked = { text = "    ", hl = "@markup", scope_hl = "@markup" },
            ["-"] = { text = "  󰡖  ", hl = "@comment", scope_hl = "@comment" }
          }
        },
        markdown = {
          list_items = {
            wrap = false,
            shift_width = 0,
            marker_minus = { add_padding = false },
            marker_plus = { add_padding = false },
            marker_star = { add_padding = false },
            -- marker_dot = { add_padding = false },
            -- marker_parenthesis = { add_padding = false },
            marker_dot = { enable = false },
            marker_parenthesis = { enable = false }
          }
        },
        renderers = {
          markdown_code_block = function(buffer, item)
            local fallback = function()
              return require("markview.renderers.markdown").code_block(buffer, item)
            end
            if item.language ~= "mermaid" then return fallback() end

            local ns = require("markview.renderers.markdown").ns
            local range = item.range

            local code = table.concat({ unpack(item.text, 2, #item.text - 1) }, "\n")
            if code == "" then return fallback() end

            local ok, result = pcall(vim.fn.system, { "termaid" }, code)
            if not ok or vim.v.shell_error ~= 0 then return fallback() end

            local ascii_lines = vim.split(vim.trim(result), "\n")
            if #ascii_lines == 0 then return fallback() end

            local code_lines = range.row_end - range.row_start
            local diag_lines = #ascii_lines
            local visible = math.min(code_lines, diag_lines)

            for l = range.row_start, range.row_start + visible - 1 do
              vim.api.nvim_buf_set_extmark(buffer, ns, l, 0, { line_hl_group = "MarkviewCode" })
            end

            for i = 1, visible do
              local l = range.row_start + (i - 1)
              local line = vim.api.nvim_buf_get_lines(buffer, l, l + 1, false)[1]
              vim.api.nvim_buf_set_extmark(buffer, ns, l, 0, { end_col = #line, conceal = "" })
              vim.api.nvim_buf_set_extmark(buffer, ns, l, 0, {
                virt_text_pos = "overlay",
                virt_text = { { ascii_lines[i], "Comment" } },
              })
            end

            -- Collapse empty lines below diagram
            if code_lines > diag_lines then
              local collapse_start = range.row_start + diag_lines
              if collapse_start < range.row_end then
                vim.api.nvim_buf_set_extmark(buffer, ns, collapse_start, 0, {
                  conceal_lines = "",
                  end_row = range.row_end,
                })
              end
            end

            -- Overflow diagram lines beyond code block
            if diag_lines > code_lines then
              local extra = {}
              for i = code_lines + 1, diag_lines do
                table.insert(extra, { { ascii_lines[i], "Comment" } })
              end
              vim.api.nvim_buf_set_extmark(buffer, ns, range.row_end - 1, 0, {
                virt_lines = extra,
                priority = 250,
              })
            end
          end
        },
        ft = { "markdown", "codecompanion", "avante" },
        cmd = "Markview"
      })

      local function find_mermaid_block(bufnr)
        local row = vim.api.nvim_win_get_cursor(0)[1] - 1
        local parser = vim.treesitter.get_parser(bufnr, "markdown")
        if not parser then return nil end

        local trees = parser:parse()
        if #trees == 0 then return nil end

        local query = vim.treesitter.query.parse("markdown", "(fenced_code_block) @block")
        local best, best_dist = nil, math.huge

        for _, node in query:iter_captures(trees[1]:root(), bufnr, 0, -1) do
          local sr, _, er = node:range()
          for child in node:iter_children() do
            if child:type() == "info_string" then
              local lang = child:named_child(0)
              if lang and vim.treesitter.get_node_text(lang, bufnr) == "mermaid" then
                local dist = (row >= sr and row <= er) and 0 or math.min(math.abs(row - sr), math.abs(row - er))
                if dist < best_dist then
                  best, best_dist = { node, sr, er }, dist
                end
              end
              break
            end
          end
        end

        return best
      end

      vim.keymap.set("n", "<leader>mmo", function()
        local bufnr = vim.api.nvim_get_current_buf()
        local block = find_mermaid_block(bufnr)
        if not block then
          vim.notify("No mermaid code block found", vim.log.levels.INFO)
          return
        end
        if not vim.fn.executable("mmdc") then
          vim.notify("mmdc not found in PATH", vim.log.levels.ERROR)
          return
        end

        local node, sr, er = block[1], block[2], block[3]
        local lines = vim.api.nvim_buf_get_lines(bufnr, sr, er, false)
        local code = table.concat({ unpack(lines, 2, #lines - 1) }, "\n")
        if code == "" then
          vim.notify("Empty mermaid block", vim.log.levels.WARN)
          return
        end

        local tmp_in, tmp_out = vim.fn.tempname(), vim.fn.tempname() .. ".png"
        vim.fn.writefile(vim.split(code, "\n"), tmp_in)
        vim.notify("Rendering mermaid…", vim.log.levels.INFO)

        local stderr_data = {}
        vim.fn.jobstart({ "mmdc", "-i", tmp_in, "-o", tmp_out, "-t", "dark", "-b", "#1e1e2f", "-s", "3" }, {
          on_stderr = function(_, data)
            if data then
              for _, line in ipairs(data) do
                if line ~= "" then table.insert(stderr_data, line) end
              end
            end
          end,
          on_exit = function(_, rc)
            vim.schedule(function()
              if rc == 0 then
                vim.ui.open(tmp_out)
              else
                local msg = table.concat(stderr_data, "\n")
                if msg == "" then msg = "(no stderr output)" end
                vim.notify("mmdc failed (" .. rc .. "):\n" .. msg, vim.log.levels.ERROR)
              end
              pcall(vim.fn.delete, tmp_in)
            end)
          end,
        })
      end, { desc = "Open mermaid block as PNG" })
    end,
  },
}
