`timescale 1ns/1ps

module adder_tb();
  reg  [3:0] a, b;
  wire [4:0] sum;

  adder UUT(a, b, sum);

  initial begin
    $dumpfile("work/adder.vcd");
    $dumpvars(0, adder_tb);

    #10
    a = 4'b0111; b = 4'b0001;
    #1
    $display("%0t: A=%0b B=%0b SUM=%0b", $time, a, b, sum);

    #10
    a = 4'b0110; b = 4'b0010;
    #1
    $display("%0t: A=%0b B=%0b SUM=%0b", $time, a, b, sum);

    #10
    $finish;
  end
endmodule