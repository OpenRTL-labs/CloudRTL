`timescale 1ns/1ps

module test_counter_tb;

reg clk;
reg reset;
wire [3:0] count;

test_counter uut (
    .clk(clk),
    .reset(reset),
    .count(count)
);

initial begin
    clk = 0;
    forever #5 clk = ~clk;
end

initial begin
    reset = 1;
    #10;
    reset = 0;
    #50;
    $finish;
end

endmodule