`timescale 1ns/1ps

module counter_tb;

    reg clk;
    reg reset;
    wire [3:0] count;

    counter #(
        .WIDTH(4)
    ) dut (
        .clk(clk),
        .reset(reset),
        .count(count)
    );

    // 10 ns clock period
    always #5 clk = ~clk;

    initial begin
        // Create waveform
        $dumpfile("work/counter.vcd");
        $dumpvars(0, counter_tb);

        // Initial conditions
        clk = 0;
        reset = 1;

        // Hold reset for one clock cycle
        #10;
        reset = 0;

        // Run counter for 100 ns
        #100;

        $finish;
    end

endmodule