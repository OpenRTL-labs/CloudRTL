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

# Setup / max-delay paths
report_checks \
    -path_delay max \
    -format full_clock_expanded \
    > /CloudRTL/git/simulator/work/counter_timing.rpt

# Hold / min-delay paths
report_checks \
    -path_delay min \
    -format full_clock_expanded \
    >> /CloudRTL/git/simulator/work/counter_timing.rpt

# Timing summary
report_wns -max >> /CloudRTL/git/simulator/work/counter_timing.rpt
report_wns -min >> /CloudRTL/git/simulator/work/counter_timing.rpt
report_tns -max >> /CloudRTL/git/simulator/work/counter_timing.rpt
report_tns -min >> /CloudRTL/git/simulator/work/counter_timing.rpt

# ------------------------------------------------------------
# 5. Power report
# ------------------------------------------------------------

report_power \
    > /CloudRTL/git/simulator/work/counter_power.rpt