# ============================================================
# CloudRTL Post-Synthesis Analysis
# Technology: Nangate45
# ============================================================

# ------------------------------------------------------------
# 1. Load technology
# ------------------------------------------------------------

read_lef /OpenROAD-flow-scripts/flow/platforms/nangate45/lef/NangateOpenCellLibrary.tech.lef
read_lef /OpenROAD-flow-scripts/flow/platforms/nangate45/lef/NangateOpenCellLibrary.macro.mod.lef

read_liberty \
    /OpenROAD-flow-scripts/flow/platforms/nangate45/lib/NangateOpenCellLibrary_typical.lib

# ------------------------------------------------------------
# 2. Load synthesized netlist
# ------------------------------------------------------------

read_verilog /CloudRTL/git/simulator/work/counter_netlist.v

link_design counter

# ------------------------------------------------------------
# 3. Read timing constraints
# ------------------------------------------------------------

read_sdc /CloudRTL/git/simulator/work/counter.sdc

# ------------------------------------------------------------
# 4. Timing report
# ------------------------------------------------------------

report_checks \
    -path_delay max \
    -format full_clock_expanded \
    > /CloudRTL/git/simulator/work/counter_timing.rpt

# ------------------------------------------------------------
# 5. Power report
# ------------------------------------------------------------

report_power \
    > /CloudRTL/git/simulator/work/counter_power.rpt