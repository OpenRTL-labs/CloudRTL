# ============================================================
# CloudRTL OpenROAD Physical Design Flow
# Technology: Nangate45
# ============================================================


# ============================================================
# 1. LOAD TECHNOLOGY
# ============================================================

read_lef /OpenROAD-flow-scripts/flow/platforms/nangate45/lef/NangateOpenCellLibrary.tech.lef

read_lef /OpenROAD-flow-scripts/flow/platforms/nangate45/lef/NangateOpenCellLibrary.macro.mod.lef


# ============================================================
# 2. LOAD TIMING LIBRARY
# ============================================================

read_liberty /OpenROAD-flow-scripts/flow/platforms/nangate45/lib/NangateOpenCellLibrary_typical.lib


# ============================================================
# 3. LOAD SYNTHESIZED NETLIST
# ============================================================

read_verilog /CloudRTL/git/simulator/work/counter_netlist.v


# ============================================================
# 4. LINK TOP-LEVEL DESIGN
# ============================================================

link_design counter


# ============================================================
# 5. INITIAL DESIGN REPORT
# ============================================================

puts "============================================================"
puts "INITIAL DESIGN AREA"
puts "============================================================"

report_design_area


# ============================================================
# 6. FLOORPLAN INITIALIZATION
# ============================================================

puts "============================================================"
puts "FLOORPLAN INITIALIZATION"
puts "============================================================"

initialize_floorplan \
    -utilization 50 \
    -aspect_ratio 1.0 \
    -core_space 2.0 \
    -site FreePDK45_38x28_10R_NP_162NW_34O


# ============================================================
# 7. GENERATE ROUTING TRACKS
# ============================================================

puts "============================================================"
puts "ROUTING TRACK GENERATION"
puts "============================================================"

make_tracks


# ============================================================
# 8. PLACE IO PINS
# ============================================================

puts "============================================================"
puts "IO PIN PLACEMENT"
puts "============================================================"

place_pins \
    -hor_layers metal3 \
    -ver_layers metal2


# ============================================================
# 9. GLOBAL PLACEMENT
# ============================================================

puts "============================================================"
puts "GLOBAL PLACEMENT"
puts "============================================================"

global_placement


# ============================================================
# 10. DETAILED PLACEMENT
# ============================================================

puts "============================================================"
puts "DETAILED PLACEMENT"
puts "============================================================"

detailed_placement


# ============================================================
# 11. PLACEMENT REPORT
# ============================================================

puts "============================================================"
puts "PLACEMENT REPORT"
puts "============================================================"

report_design_area


# ============================================================
# 12. WRITE PLACED DESIGN
# ============================================================

puts "============================================================"
puts "WRITING PLACED DESIGN"
puts "============================================================"

write_def /CloudRTL/git/physical/work/counter_placed.def


# ============================================================
# 13. FINAL STATUS
# ============================================================

puts "============================================================"
puts "PHYSICAL DESIGN STAGE COMPLETE"
puts "============================================================"

puts "Placed DEF:"
puts "/CloudRTL/git/physical/work/counter_placed.def"

# ============================================================
# 14. GLOBAL ROUTING
# ============================================================

puts "============================================================"
puts "GLOBAL ROUTING"
puts "============================================================"

global_route \
    -guide_file /CloudRTL/git/physical/work/counter.route.guide \
    -congestion_report_file /CloudRTL/git/physical/work/counter_congestion.rpt

# ============================================================
# 15. DETAILED ROUTING
# ============================================================

puts "============================================================"
puts "DETAILED ROUTING"
puts "============================================================"

detailed_route \
    -output_drc /CloudRTL/git/physical/work/counter_route_drc.rpt

# ============================================================
# 16. ROUTING REPORT
# ============================================================

puts "============================================================"
puts "ROUTING REPORT"
puts "============================================================"

report_wire_length -detailed_route -summary

# Check whether all nets have been routed
design_is_routed -verbose

# ============================================================
# 17. WRITE FINAL ROUTED DESIGN
# ============================================================

puts "============================================================"
puts "WRITING ROUTED DESIGN"
puts "============================================================"

write_def /CloudRTL/git/physical/work/counter_routed.def

puts "============================================================"
puts "ROUTING STAGE COMPLETE"
puts "============================================================"

# ============================================================
# 18. TIMING CONSTRAINTS
# ============================================================

puts "============================================================"
puts "TIMING CONSTRAINTS"
puts "============================================================"

create_clock -name clk -period 10 [get_ports clk]

# ============================================================
# 19. POST-ROUTE TIMING ANALYSIS
# ============================================================

puts "============================================================"
puts "POST-ROUTE TIMING ANALYSIS"
puts "============================================================"

report_checks -path_delay max -format full_clock_expanded
report_checks -path_delay min -format full_clock_expanded

# ============================================================
# 20. TIMING SUMMARY
# ============================================================

puts "============================================================"
puts "TIMING SUMMARY"
puts "============================================================"

report_worst_slack -max
report_worst_slack -min
report_tns

# ============================================================
# FINAL PHYSICAL DESIGN REPORT
# ============================================================

puts "============================================================"
puts "FINAL PHYSICAL DESIGN REPORT"
puts "============================================================"

puts ""
puts "DESIGN AREA"
puts "------------------------------------------------------------"
report_design_area

puts ""
puts "ROUTING WIRE LENGTH"
puts "------------------------------------------------------------"
report_wire_length -detailed_route -summary

puts ""
puts "TIMING - SETUP"
puts "------------------------------------------------------------"
report_checks -path_delay max -format full_clock_expanded

puts ""
puts "TIMING - HOLD"
puts "------------------------------------------------------------"
report_checks -path_delay min -format full_clock_expanded

puts ""
puts "TIMING SUMMARY"
puts "------------------------------------------------------------"
report_worst_slack -max
report_worst_slack -min
report_tns

puts ""
puts "FINAL OUTPUT"
puts "------------------------------------------------------------"
puts "Placed DEF:"
puts "/CloudRTL/git/physical/work/counter_placed.def"
puts ""
puts "Routed DEF:"
puts "/CloudRTL/git/physical/work/counter_routed.def"
puts ""
puts "Routing Guide:"
puts "/CloudRTL/git/physical/work/counter.route.guide"
puts ""
puts "Routing DRC Report:"
puts "/CloudRTL/git/physical/work/counter_route_drc.rpt"

puts ""
puts "============================================================"
puts "CLOUDRTL PHYSICAL DESIGN FLOW COMPLETE"
puts "============================================================"